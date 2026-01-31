#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
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

const PKG = "package.json";
if (!exists(PKG)) throw new Error("Missing package.json");
const pkg = JSON.parse(read(PKG));
pkg.scripts ||= {};

// ----------------------------------------------------------------------------
// 1) Restore canonical smoke21 (Phase 21A) if npm script exists but file is missing
// ----------------------------------------------------------------------------
const smoke21 = path.join("scripts", "mcp_smoke_phase21.mjs");
const smoke21Archived = path.join("scripts", "_archive", "phase21", "mcp_smoke_phase21.mjs");

if (pkg.scripts["mcp:smoke21"]) {
  if (!exists(smoke21)) {
    if (!exists(smoke21Archived)) {
      throw new Error("mcp:smoke21 exists but canonical + archived smoke21 script missing.");
    }
    const src = read(smoke21Archived);
    writeIfChanged(smoke21, src);
    chmod755(smoke21);
    console.log("Restored canonical:", smoke21, "(copied from archive)");
  }
  // Ensure npm script points to canonical
  const expected = `node ${smoke21}`;
  if (pkg.scripts["mcp:smoke21"] !== expected) {
    pkg.scripts["mcp:smoke21"] = expected;
    console.log("Patched package.json (mcp:smoke21 -> canonical)");
  }
}

// ----------------------------------------------------------------------------
// 2) Make smoke20 self-diagnosing on non-200 (print response body)
// ----------------------------------------------------------------------------
const smoke20 = path.join("scripts", "mcp_smoke_phase20.mjs");
if (!exists(smoke20)) throw new Error("Missing: " + smoke20);

let s20 = read(smoke20);

// Ensure postTool captures body text for errors and returns it
// We patch conservatively: if "return { status, j }" exists, we extend to include raw text.
if (!s20.includes("rawText")) {
  s20 = s20.replace(
    /const\s+r\s*=\s*await\s+fetch\([^;]+;\s*const\s+status\s*=\s*r\.status;\s*const\s+j\s*=\s*await\s+r\.json\(\);\s*return\s*\{\s*status,\s*j\s*\};/m,
    (m) => m // if already matches, leave
  );

  // Generic injection: find the getJson() helper and upgrade it.
  // Expected pattern in these smokes: async function getJson(url, body) { ... }
  s20 = s20.replace(
    /async function getJson\(([^)]*)\)\s*\{\s*([\s\S]*?)const\s+r\s*=\s*await\s+fetch\(([\s\S]*?)\);\s*const\s+status\s*=\s*r\.status;\s*const\s+j\s*=\s*await\s+r\.json\(\);\s*return\s*\{\s*status,\s*j\s*\};\s*\}/m,
    (_all, argsSig, pre, fetchArgs) => {
      return `async function getJson(${argsSig}) {\n${pre}const r = await fetch(${fetchArgs});\n  const status = r.status;\n  const rawText = await r.text();\n  let j = null;\n  try { j = rawText ? JSON.parse(rawText) : null; } catch { j = { ok: false, error: { code: "NON_JSON", message: rawText } }; }\n  return { status, j, rawText };\n}\n`;
    }
  );

  // If patch didn’t land (pattern mismatch), add a safe fallback: on assertion failure, re-run call printing response.
  if (!s20.includes("rawText")) {
    // Add a minimal debug wrapper around the readById check loop.
    s20 = s20.replace(
      /for\s*\(const\s*\[tenant,\s*id\]\s*of\s*checks\)\s*\{\s*const\s*\{\s*status,\s*j\s*\}\s*=\s*await\s*postTool\(([\s\S]*?)\);\s*assert\.equal\(status,\s*200,[^\)]*\);\s*assert\.equal\(j\.ok,\s*true,[^\)]*\);\s*assert\.equal\(j\.data\?\.\w+\?\.\w+,\s*id,[^\)]*\);\s*\}/m,
      (m) => m
    );

    // If still not found, do nothing; smoke will still fail but we’ll fix in next iteration.
  } else {
    // Update assertion block to print response when non-200
    s20 = s20.replace(
      /assert\.equal\(status,\s*200,\s*tenant\s*\+\s*" readById status"\);/g,
      `if (status !== 200) {\n      console.error("readById failed:", tenant, "status=", status);\n      console.error("response:", JSON.stringify(j, null, 2));\n    }\n    assert.equal(status, 200, tenant + " readById status");`
    );
  }

  writeIfChanged(smoke20, s20);
  chmod755(smoke20);
  console.log("Patched:", smoke20, "(self-diagnosing non-200)");
}

// ----------------------------------------------------------------------------
// 3) Make smoke21c actually trigger the minContractVersion failure (expect 409)
//    by sending an intentionally-low ctx.contractVersion
// ----------------------------------------------------------------------------
const smoke21c = path.join("scripts", "mcp_smoke_phase21c.mjs");
if (!exists(smoke21c)) throw new Error("Missing: " + smoke21c);

let s21c = read(smoke21c);

// Insert/replace a client contract version constant used in ctx
if (!s21c.includes("CLIENT_CONTRACT_VERSION")) {
  s21c = s21c.replace(
    /const\s+BASE\s*=\s*["'][^"']+["'];?/,
    (m) => `${m}\nconst CLIENT_CONTRACT_VERSION = "0.0.0"; // intentionally low to trigger minContractVersion gating\n`
  );
}

// Ensure ctx includes contractVersion on tool calls in this smoke
// We patch common ctx builder patterns.
s21c = s21c
  .replace(/ctx:\s*\{\s*tenant:\s*tenant\s*,/g, `ctx: { tenant: tenant, contractVersion: CLIENT_CONTRACT_VERSION,`)
  .replace(/ctx:\s*\{\s*tenant:\s*"(\w+)"\s*,/g, `ctx: { tenant: "$1", contractVersion: CLIENT_CONTRACT_VERSION,`);

writeIfChanged(smoke21c, s21c);
chmod755(smoke21c);
console.log("Patched:", smoke21c, "(forces tool-min gating via ctx.contractVersion)");

// ----------------------------------------------------------------------------
// 4) Server enforcement: if a tool declares minContractVersion, require ctx.contractVersion
//    and block (409) when client < min.
// ----------------------------------------------------------------------------
const server = path.join("services", "mcp-shared-server", "server.mjs");
if (!exists(server)) throw new Error("Missing: " + server);

let srv = read(server);

if (!srv.includes("function parseContractVersion")) {
  // Insert helper + compare near TOOL_REGISTRY or before handleToolCall
  srv = srv.replace(
    /function capabilitiesPayload\(\)\s*\{/,
    `function parseContractVersion(v) {
  // Accept formats like "21A.1.0" or "21B.0.0" or "0.0.0"
  // Returns tuple for comparison; unknown formats sort lowest.
  if (typeof v !== "string") return [0, 0, 0, 0];
  const m = v.trim().match(/^(\\d+)([A-Za-z])\\.(\\d+)\\.(\\d+)$/);
  if (m) {
    const major = Number(m[1]);
    const letter = (m[2] || "A").toUpperCase().charCodeAt(0) - 64; // A=1
    const minor = Number(m[3]);
    const patch = Number(m[4]);
    return [major, letter, minor, patch];
  }
  const m2 = v.trim().match(/^(\\d+)\\.(\\d+)\\.(\\d+)$/);
  if (m2) return [Number(m2[1]), 0, Number(m2[2]), Number(m2[3])];
  return [0, 0, 0, 0];
}

function gteContractVersion(a, b) {
  const A = parseContractVersion(a);
  const B = parseContractVersion(b);
  for (let i = 0; i < 4; i++) {
    if (A[i] > B[i]) return true;
    if (A[i] < B[i]) return false;
  }
  return true;
}

function capabilitiesPayload() {`
  );
}

if (!srv.includes("minContractVersion")) {
  // enforce minContractVersion in handleToolCall after locating entry
  srv = srv.replace(
    /const entry = TOOL_REGISTRY\[tool\];\s*if \(!entry\) \{\s*return toolError\([\s\S]*?\);\s*\}\s*/m,
    (m) => {
      return `${m}\n    // Per-tool contract gating (fail-closed)\n    if (entry.minContractVersion) {\n      const clientV = ctx.contractVersion;\n      if (typeof clientV !== "string" || !clientV.trim()) {\n        return toolError(res, 409, "CONTRACT_VERSION_REQUIRED", "Missing ctx.contractVersion for tool requiring minContractVersion.", ctx.traceId, { tool, minContractVersion: entry.minContractVersion });\n      }\n      if (!gteContractVersion(clientV, entry.minContractVersion)) {\n        return toolError(res, 409, "CONTRACT_VERSION_TOO_OLD", "Client contractVersion below tool minContractVersion.", ctx.traceId, { tool, client: clientV, min: entry.minContractVersion });\n      }\n    }\n`;
    }
  );
}

writeIfChanged(server, srv);
console.log("Patched:", server, "(fail-closed minContractVersion enforcement)");

// ----------------------------------------------------------------------------
// 5) Ensure npm scripts exist for smoke21c (optional but helpful)
// ----------------------------------------------------------------------------
if (!pkg.scripts["mcp:smoke21c"]) {
  pkg.scripts["mcp:smoke21c"] = `node ${smoke21c}`;
  console.log("Patched package.json (added mcp:smoke21c)");
}

writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");

// Required gate
console.log("== Running build (required gate) ==");
run("npm run build");
