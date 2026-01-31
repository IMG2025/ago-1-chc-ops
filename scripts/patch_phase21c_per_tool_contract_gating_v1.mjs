#!/usr/bin/env node
/**
 * Phase 21C — Per-tool contract gating (minContractVersion).
 * Idempotent. Required gate: npm run build
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
  return prev !== next;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SERVER = "services/mcp-shared-server/server.mjs";
const PKG = "package.json";
const SMOKE = "scripts/mcp_smoke_phase21c.mjs";

if (!exists(SERVER)) throw new Error("Missing: " + SERVER);
if (!exists(PKG)) throw new Error("Missing: " + PKG);

let src = read(SERVER);

// --------- 1) Ensure contract constants exist / updated ----------
const CONTRACT_CONST_ANCHOR = `const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];`;

if (!src.includes(CONTRACT_CONST_ANCHOR)) {
  throw new Error("Unsafe: REQUIRED_CTX_FIELDS anchor not found.");
}

const CONTRACT_CONST_BLOCK =
`const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
// == Contract evolution ==
const CONTRACT_VERSION = "21C.1.0";
const MIN_SUPPORTED_CONTRACT_VERSION = "21A.1.0";`;

if (!src.includes('const CONTRACT_VERSION = "21C.1.0";') || !src.includes('const MIN_SUPPORTED_CONTRACT_VERSION = "21A.1.0";')) {
  // Replace the single REQUIRED_CTX_FIELDS line if present as original, otherwise update existing values.
  if (src.includes(CONTRACT_CONST_ANCHOR)) {
    // If we already added earlier versions, normalize by replacing the whole block around REQUIRED_CTX_FIELDS.
    // Strategy: replace the first occurrence of REQUIRED_CTX_FIELDS line with our extended block,
    // then remove any older CONTRACT_VERSION/MIN_SUPPORTED duplicates later via simple de-dupe.
    src = src.replace(CONTRACT_CONST_ANCHOR, CONTRACT_CONST_BLOCK);
    // De-dupe older constants if they exist below (best-effort, safe).
    src = src.replace(/\nconst CONTRACT_VERSION = ".*?";\n/g, "\n");
    src = src.replace(/\nconst MIN_SUPPORTED_CONTRACT_VERSION = ".*?";\n/g, "\n");
    // Re-insert our canonical constants right after REQUIRED_CTX_FIELDS (already done above).
    // Ensure we didn't remove our new ones:
    if (!src.includes('const CONTRACT_VERSION = "21C.1.0";') || !src.includes('const MIN_SUPPORTED_CONTRACT_VERSION = "21A.1.0";')) {
      // If our replace was affected by de-dupe, enforce once:
      src = src.replace(`const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];`,
        `const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
// == Contract evolution ==
const CONTRACT_VERSION = "21C.1.0";
const MIN_SUPPORTED_CONTRACT_VERSION = "21A.1.0";`);
    }
  }
}

// --------- 2) Add version compare helpers (idempotent) ----------
if (!src.includes("function parseContractVersion")) {
  const insertAfter = "function isToolAllowed(tool, tenant) {";
  if (!src.includes(insertAfter)) throw new Error("Unsafe: isToolAllowed anchor not found.");

  const helpers =
`function parseContractVersion(v) {
  // Expected: "21A.1.0" -> { phase: 21, suffix: "A", patch: 1, minor: 0 }
  // Also tolerates "21.1.0" -> suffix "".
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^([0-9]+)([A-Za-z]?)[.]([0-9]+)[.]([0-9]+)$/);
  if (!m) return null;
  const phase = Number(m[1]);
  const suffix = (m[2] || "").toUpperCase();
  const patch = Number(m[3]);
  const minor = Number(m[4]);
  if (!Number.isFinite(phase) || !Number.isFinite(patch) || !Number.isFinite(minor)) return null;
  const suffixRank = suffix ? (suffix.charCodeAt(0) - 64) : 0; // A=1, B=2...
  return { phase, suffix, suffixRank, patch, minor, raw: v.trim() };
}

function cmpContractVersion(a, b) {
  const A = parseContractVersion(a);
  const B = parseContractVersion(b);
  if (!A || !B) return null;
  if (A.phase !== B.phase) return A.phase < B.phase ? -1 : 1;
  if (A.suffixRank !== B.suffixRank) return A.suffixRank < B.suffixRank ? -1 : 1;
  if (A.patch !== B.patch) return A.patch < B.patch ? -1 : 1;
  if (A.minor !== B.minor) return A.minor < B.minor ? -1 : 1;
  return 0;
}

function assertContractWindow(ctxVersion) {
  // Enforce: MIN_SUPPORTED <= ctx.contractVersion <= CONTRACT_VERSION
  const lo = cmpContractVersion(ctxVersion, MIN_SUPPORTED_CONTRACT_VERSION);
  const hi = cmpContractVersion(ctxVersion, CONTRACT_VERSION);
  if (lo === null || hi === null) throw new Error("Invalid ctx.contractVersion format");
  if (lo < 0) return { ok: false, code: "CONTRACT_TOO_OLD", status: 409, details: { minSupported: MIN_SUPPORTED_CONTRACT_VERSION, got: ctxVersion } };
  if (hi > 0) return { ok: false, code: "CONTRACT_TOO_NEW", status: 409, details: { current: CONTRACT_VERSION, got: ctxVersion } };
  return { ok: true };
}

function assertToolMinContract(ctxVersion, minVersion) {
  if (!minVersion) return { ok: true };
  const c = cmpContractVersion(ctxVersion, minVersion);
  if (c === null) throw new Error("Invalid contract version compare");
  if (c < 0) return { ok: false, code: "CONTRACT_UNSUPPORTED_FOR_TOOL", status: 409, details: { toolMin: minVersion, got: ctxVersion } };
  return { ok: true };
}

`;
  src = src.replace(insertAfter, helpers + insertAfter);
}

// --------- 3) Ensure capabilitiesPayload reports contractVersion + minSupported ----------
if (!src.includes("minSupportedContractVersion")) {
  // capabilitiesPayload() already exists; we add fields in returned object.
  const capAnchor = 'schema: "mcp.capabilities.v1",';
  if (!src.includes(capAnchor)) throw new Error("Unsafe: capabilitiesPayload schema anchor not found.");

  src = src.replace(
    capAnchor,
    'schema: "mcp.capabilities.v1",\n      contractVersion: CONTRACT_VERSION,\n      minSupportedContractVersion: MIN_SUPPORTED_CONTRACT_VERSION,'
  );
} else {
  // Normalize contractVersion values if present as literals
  src = src.replace(/contractVersion:\s*".*?"/g, 'contractVersion: CONTRACT_VERSION');
  src = src.replace(/minSupportedContractVersion:\s*".*?"/g, 'minSupportedContractVersion: MIN_SUPPORTED_CONTRACT_VERSION');
}

// --------- 4) Add minContractVersion to TOOL_REGISTRY entries + set a canary tool to 21C.1.0 ----------
if (!src.includes("minContractVersion")) {
  // Add minContractVersion to each tool entry by injecting after version field.
  // This is safe because tool objects already have `version: "1.0.0",`
  src = src.replace(
    /version:\s*"1\.0\.0",/g,
    'version: "1.0.0",\n      minContractVersion: "21A.1.0",'
  );

  // Canary: require 21C.1.0 for shared.artifact_registry.search (demonstrates tool-level gating)
  src = src.replace(
    /"shared\.artifact_registry\.search":\s*\{\n([\s\S]*?)minContractVersion:\s*"21A\.1\.0",/m,
    `"shared.artifact_registry.search": {\n$1minContractVersion: "21C.1.0",`
  );
} else {
  // Ensure canary remains 21C.1.0
  src = src.replace(
    /"shared\.artifact_registry\.search":\s*\{([\s\S]*?)minContractVersion:\s*".*?"/m,
    `"shared.artifact_registry.search": {$1minContractVersion: "21C.1.0"`
  );
}

// --------- 5) Enforce window + per-tool min inside handleToolCall ----------
const handleAnchor = "const entry = TOOL_REGISTRY[tool];";
if (!src.includes(handleAnchor)) throw new Error("Unsafe: handleToolCall entry anchor not found.");

if (!src.includes("assertContractWindow(") || !src.includes("assertToolMinContract(")) {
  // Insert enforcement right before tool registry lookup (after ctx validation + allowlist check).
  const insertPoint = "if (!isToolAllowed(tool, ctx.tenant)) {";
  if (!src.includes(insertPoint)) throw new Error("Unsafe: allowlist anchor not found.");

  // We want to insert after allowlist check block. We'll locate the closing brace of that block by matching the exact line.
  // The block ends with: return toolError(...); });
  const blockNeedle = "return toolError(res, 403, \"FORBIDDEN\", \"Tool not allowed for tenant.\", ctx.traceId, { tool, tenant: ctx.tenant });";
  if (!src.includes(blockNeedle)) throw new Error("Unsafe: allowlist error line not found.");

  // Insert immediately after the allowlist block closes (the next line after the closing brace).
  // Safer: insert after the `}` that closes the if block by targeting the exact blockNeedle line + following `}`.
  src = src.replace(
    blockNeedle + "\n    }\n",
    blockNeedle + `\n    }\n\n    // Contract window enforcement (phase 21C)\n    try {\n      const w = assertContractWindow(ctx.contractVersion);\n      if (!w.ok) return toolError(res, w.status, w.code, "Contract version not supported.", ctx.traceId, w.details);\n    } catch (e) {\n      return toolError(res, 400, "BAD_REQUEST", (e && e.message) ? e.message : "Invalid contractVersion.", ctx.traceId);\n    }\n`
  );

  // Now insert per-tool min check after `entry` is retrieved (but before executing handler)
  src = src.replace(
    "if (!entry) {\n      return toolError(res, 404, \"TOOL_NOT_FOUND\", \"Unknown tool\", ctx.traceId, { tool });\n    }\n",
    "if (!entry) {\n      return toolError(res, 404, \"TOOL_NOT_FOUND\", \"Unknown tool\", ctx.traceId, { tool });\n    }\n\n    // Per-tool min contract gating (phase 21C)\n    try {\n      const m = assertToolMinContract(ctx.contractVersion, entry.minContractVersion);\n      if (!m.ok) return toolError(res, m.status, m.code, \"Contract version not supported for tool.\", ctx.traceId, { tool, ...m.details });\n    } catch (e) {\n      return toolError(res, 400, \"BAD_REQUEST\", (e && e.message) ? e.message : \"Invalid contractVersion.\", ctx.traceId);\n    }\n"
  );
}

// --------- 6) Ensure /tools includes minContractVersion so clients can self-negotiate ----------
if (!src.includes("minContractVersion:")) {
  // toolsPayload() exists; add minContractVersion field in returned map.
  const toolsAnchor = "description: v.description || \"\"";
  if (!src.includes(toolsAnchor)) throw new Error("Unsafe: toolsPayload anchor not found.");

  src = src.replace(
    toolsAnchor,
    'description: v.description || "",\n      ...(v.minContractVersion ? { minContractVersion: v.minContractVersion } : {})'
  );
}

// --------- 7) Write smoke21c (idempotent) ----------
const smokeSrc =
`#!/usr/bin/env node
/**
 * Smoke 21C — tool-level minContractVersion gating + window support.
 * Expects server running on 127.0.0.1:8787
 */
import assert from "node:assert";

const BASE = process.env.MCP_BASE || "http://127.0.0.1:8787";

async function getJson(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

async function postTool(tool, tenant, args, contractVersion) {
  const body = {
    tool,
    args,
    ctx: {
      tenant,
      actor: "smoke",
      purpose: "phase21c",
      classification: "internal",
      traceId: "t21c-smoke",
      contractVersion
    }
  };
  const r = await fetch(BASE + "/tool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

(async () => {
  // Capabilities must expose current + minSupported
  const caps = await getJson(BASE + "/capabilities");
  assert.equal(caps.status, 200, "capabilities status");
  assert.equal(caps.j.ok, true, "capabilities ok");
  assert.equal(typeof caps.j.contractVersion, "string", "capabilities contractVersion");
  assert.equal(typeof caps.j.minSupportedContractVersion, "string", "capabilities minSupportedContractVersion");

  // Window check: too-new must fail
  {
    const r = await postTool("shared.artifact_registry.read", "shared", {}, "99Z.9.9");
    assert.equal(r.status, 409, "too-new status");
    assert.equal(r.j.ok, false, "too-new ok false");
  }

  // Window check: min-supported works for older tools
  {
    const r = await postTool("shared.artifact_registry.read", "shared", {}, "21A.1.0");
    assert.equal(r.status, 200, "min-supported read status");
    assert.equal(r.j.ok, true, "min-supported read ok");
  }

  // Tool-level canary: search requires 21C.1.0, so 21A.1.0 must fail
  {
    const r = await postTool("shared.artifact_registry.search", "shared", { q: "ECF" }, "21A.1.0");
    assert.equal(r.status, 409, "tool-min fail status");
    assert.equal(r.j.ok, false, "tool-min fail ok false");
  }

  // Tool-level canary: 21C.1.0 must pass
  {
    const r = await postTool("shared.artifact_registry.search", "shared", { q: "ECF" }, "21C.1.0");
    assert.equal(r.status, 200, "tool-min pass status");
    assert.equal(r.j.ok, true, "tool-min pass ok");
  }

  console.log(JSON.stringify({
    ok: true,
    phase: "21C",
    base: BASE,
    observed: {
      contractVersion: caps.j.contractVersion,
      minSupported: caps.j.minSupportedContractVersion
    }
  }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;

writeIfChanged(SMOKE, smokeSrc);
try { fs.chmodSync(SMOKE, 0o755); } catch {}

// --------- 8) Wire npm script mcp:smoke21c ----------
const pkg = JSON.parse(read(PKG));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke21c"]) {
  pkg.scripts["mcp:smoke21c"] = "node scripts/mcp_smoke_phase21c.mjs";
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
}

// --------- 9) Persist server changes ----------
const changed = writeIfChanged(SERVER, src);
console.log(changed ? "Patched: " + SERVER : "No changes needed: " + SERVER);
console.log("Ensured: " + SMOKE);
console.log("Ensured: package.json (mcp:smoke21c)");

// --------- 10) Required gate: build ----------
console.log("== Running build (required gate) ==");
run("npm run build");
