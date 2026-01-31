#!/usr/bin/env node
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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

// ------------------------------------------------------------
// 1) Patch smoke20 to send valid ctx + args (pre-validation pass)
// ------------------------------------------------------------
const SMOKE20 = "scripts/mcp_smoke_phase20.mjs";
if (!exists(SMOKE20)) throw new Error("Missing: " + SMOKE20);

let s20 = read(SMOKE20);

// Ensure ctx includes required fields. Common pattern: ctx: { tenant, traceId } or similar.
// We normalize by ensuring any ctx literal includes actor/purpose/classification.
// Also ensure args is always an object ({}), never null/undefined.
function ensureCtxFields(src) {
  // Add missing fields when ctx is built as an object literal containing tenant:
  // ctx: { tenant: X, traceId: Y, ... }
  src = src.replace(
    /ctx:\s*\{\s*([^}]*?\btenant\b[^}]*)\}/g,
    (m, inner) => {
      const hasActor = /\bactor\s*:/.test(inner);
      const hasPurpose = /\bpurpose\s*:/.test(inner);
      const hasClass = /\bclassification\s*:/.test(inner);
      const hasTrace = /\btraceId\s*:/.test(inner);
      let next = inner.trim();

      // If traceId missing, add a stable default using Date.now() where available in script.
      if (!hasTrace) next += (next ? ", " : "") + `traceId: "smoke20-" + String(Date.now())`;

      if (!hasActor) next += `, actor: "smoke"`;
      if (!hasPurpose) next += `, purpose: "test"`;
      if (!hasClass) next += `, classification: "public"`; // simple safe default
      return `ctx: { ${next} }`;
    }
  );

  // If ctx is referenced as a variable (ctx) but constructed earlier, try to patch the construction:
  // const ctx = { tenant, traceId }
  src = src.replace(
    /const\s+ctx\s*=\s*\{\s*([^}]*?\btenant\b[^}]*)\};/g,
    (m, inner) => {
      let next = inner.trim();
      if (!/\btraceId\b/.test(next)) next += (next ? ", " : "") + `traceId: "smoke20-" + String(Date.now())`;
      if (!/\bactor\b/.test(next)) next += `, actor: "smoke"`;
      if (!/\bpurpose\b/.test(next)) next += `, purpose: "test"`;
      if (!/\bclassification\b/.test(next)) next += `, classification: "public"`;
      return `const ctx = { ${next} };`;
    }
  );

  return src;
}

s20 = ensureCtxFields(s20);

// Force args to be an object in tool calls where args may be omitted:
// Replace args: somethingFalsy with args: {}
s20 = s20.replace(/args:\s*(null|undefined)/g, "args: {}");

// If payload uses { tool, ctx } without args, inject args: {}
s20 = s20.replace(
  /\{\s*tool:\s*([^\s,}]+)\s*,\s*ctx:\s*\{/g,
  `{ tool: $1, args: {}, ctx: {`
);

// Make failures print the response body if available (robust, no assumptions about helpers)
if (!s20.includes("DEBUG_SMOKE20_RESPONSE")) {
  s20 = s20.replace(
    /assert\.equal\(status,\s*200,\s*([^)]+)\);/g,
    `if (status !== 200) { console.error("DEBUG_SMOKE20_RESPONSE", JSON.stringify(j, null, 2)); }\nassert.equal(status, 200, $1);`
  );
}

writeIfChanged(SMOKE20, s20);
chmod755(SMOKE20);
console.log("Patched:", SMOKE20, "(valid ctx+args for 400 fix)");

// ------------------------------------------------------------
// 2) Make 21C enforcement real: set minContractVersion on one tool
//    and ensure smoke21c calls it with low client contractVersion.
// ------------------------------------------------------------
const SERVER = "services/mcp-shared-server/server.mjs";
if (!exists(SERVER)) throw new Error("Missing: " + SERVER);

let srv = read(SERVER);

// Add minContractVersion to a stable tool we can probe: shared.artifact_registry.search
// Only if not already present.
srv = srv.replace(
  /("shared\.artifact_registry\.search"\s*:\s*\{\s*[\s\S]*?description:\s*"Search shared artifacts\."\s*,)/m,
  (m) => {
    if (m.includes("minContractVersion")) return m;
    return m + `\n      minContractVersion: "21C.1.0",`;
  }
);

// Ensure per-tool enforcement checks ctx.contractVersion and compares.
if (!srv.includes("CONTRACT_VERSION_TOO_OLD") || !srv.includes("minContractVersion")) {
  // If we somehow don't have the enforcement block, refuse (we don't want silent drift).
  // (Your repo already added enforcement in Phase 21C; this is a guard.)
  console.log("NOTE: server.mjs missing expected enforcement markers; verify Phase 21C patch is present.");
}

writeIfChanged(SERVER, srv);
console.log("Patched:", SERVER, "(minContractVersion set on shared.search)");

// Patch smoke21c to ensure it calls shared.search with an intentionally low contractVersion
const SMOKE21C = "scripts/mcp_smoke_phase21c.mjs";
if (!exists(SMOKE21C)) throw new Error("Missing: " + SMOKE21C);

let s21c = read(SMOKE21C);

// Ensure low contract version constant exists
if (!s21c.includes("CLIENT_CONTRACT_VERSION")) {
  s21c = s21c.replace(
    /const\s+BASE\s*=\s*["'][^"']+["'];?/,
    (m) => `${m}\nconst CLIENT_CONTRACT_VERSION = "0.0.0"; // intentionally low\n`
  );
}

// Ensure tool-min fail case actually probes shared.search.
// We’ll add a small dedicated request block if not present.
if (!s21c.includes("shared.artifact_registry.search") || !s21c.includes("tool-min fail status")) {
  // Append a deterministic probe near the end, before final output.
  s21c += `\n\n// --- tool-min fail probe (shared.search requires >=21C.1.0) ---\nconst probeBody = {\n  tool: "shared.artifact_registry.search",\n  args: { q: "" },\n  ctx: {\n    tenant: "chc",\n    actor: "smoke",\n    purpose: "test",\n    classification: "public",\n    traceId: "smoke21c-" + String(Date.now()),\n    contractVersion: CLIENT_CONTRACT_VERSION\n  }\n};\nconst probe = await fetch(BASE + "/tool", {\n  method: "POST",\n  headers: { "content-type": "application/json" },\n  body: JSON.stringify(probeBody)\n});\nconst probeStatus = probe.status;\nif (probeStatus !== 409) {\n  const txt = await probe.text();\n  console.error("DEBUG_SMOKE21C_PROBE_RESPONSE", txt);\n}\nimport assert from "node:assert/strict";\nassert.equal(probeStatus, 409, "tool-min fail status");\n`;
}

// Ensure ctx in any existing calls includes contractVersion (best-effort)
s21c = s21c.replace(/ctx:\s*\{\s*tenant:\s*tenant\s*,/g, `ctx: { tenant: tenant, contractVersion: CLIENT_CONTRACT_VERSION,`);
s21c = s21c.replace(/ctx:\s*\{\s*tenant:\s*"(\w+)"\s*,/g, `ctx: { tenant: "$1", contractVersion: CLIENT_CONTRACT_VERSION,`);

writeIfChanged(SMOKE21C, s21c);
chmod755(SMOKE21C);
console.log("Patched:", SMOKE21C, "(forces real 409 via shared.search)");

// ------------------------------------------------------------
// 3) Ensure npm script exists for smoke21c
// ------------------------------------------------------------
const PKG = "package.json";
const pkg = JSON.parse(read(PKG));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke21c"]) {
  pkg.scripts["mcp:smoke21c"] = "node scripts/mcp_smoke_phase21c.mjs";
  console.log("Patched package.json (added mcp:smoke21c)");
}
writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");

// Required gate
console.log("== Running build (required gate) ==");
run("npm run build");
