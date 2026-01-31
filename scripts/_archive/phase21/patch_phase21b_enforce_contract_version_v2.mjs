#!/usr/bin/env node
/**
 * Phase 21B — Enforce ctx.contractVersion (fail-closed)
 * Robust anchor: inject after assertCtx(ctx);
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const SERVER = "services/mcp-shared-server/server.mjs";
const PKG = "package.json";
const SMOKE = "scripts/mcp_smoke_phase21b.mjs";

if (!exists(SERVER)) throw new Error("Missing: " + SERVER);
if (!exists(PKG)) throw new Error("Missing: " + PKG);

// ---- Read server ----
let src = read(SERVER);

// ---- Determine authoritative contract version from capabilities ----
const cvMatch = src.match(/contractVersion:\s*"([^"]+)"/);
if (!cvMatch) {
  throw new Error("Unsafe: capabilities contractVersion not found.");
}
const CONTRACT_VERSION = cvMatch[1];

// ---- Ensure optionalCtxFields advertised ----
if (!src.includes("optionalCtxFields")) {
  src = src.replace(
    /contractVersion:\s*"[^"]+",/m,
    (m) => `${m}\n      optionalCtxFields: ["contractVersion"],`
  );
}

// ---- Enforce contract version after assertCtx(ctx); ----
const SENTINEL = "/* PHASE21B_CONTRACT_ENFORCEMENT */";
if (!src.includes(SENTINEL)) {
  const needle = "assertCtx(ctx);";
  const idx = src.indexOf(needle);
  if (idx === -1) {
    throw new Error("Unsafe: assertCtx(ctx) anchor not found.");
  }

  const insertAt = idx + needle.length;
  const enforcement = `
    ${SENTINEL}
    const expectedContractVersion = "${CONTRACT_VERSION}";
    if (!ctx.contractVersion || typeof ctx.contractVersion !== "string" || !ctx.contractVersion.trim()) {
      return toolError(
        res,
        400,
        "CONTRACT_VERSION_REQUIRED",
        "Missing ctx.contractVersion.",
        ctx.traceId,
        { expected: expectedContractVersion }
      );
    }
    if (ctx.contractVersion !== expectedContractVersion) {
      return toolError(
        res,
        409,
        "CONTRACT_VERSION_MISMATCH",
        "Unsupported ctx.contractVersion.",
        ctx.traceId,
        { expected: expectedContractVersion, got: ctx.contractVersion }
      );
    }`;

  src = src.slice(0, insertAt) + enforcement + src.slice(insertAt);
}

writeIfChanged(SERVER, src);
console.log("Patched:", SERVER);

// ---- Smoke already exists? Do nothing if so ----
if (!exists(SMOKE)) {
  throw new Error("Expected existing smoke21b script missing: " + SMOKE);
}

// ---- Wire package.json ----
const pkg = JSON.parse(read(PKG));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke21b"]) {
  pkg.scripts["mcp:smoke21b"] = "node scripts/mcp_smoke_phase21b.mjs";
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched:", PKG, "(added mcp:smoke21b)");
}

// ---- Gates ----
console.log("== Syntax check (required gate) ==");
run("node --check " + SERVER);

console.log("== Running build (required gate) ==");
run("npm run build");
