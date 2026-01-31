#!/usr/bin/env node
/**
 * Phase 21A — Capabilities Contract Hardening
 * Ensures:
 *  - /capabilities includes contractVersion (stable)
 *  - toolsPayload() is deterministic (sorted)
 *  - Adds mcp:smoke21 contract test
 *  - Adds npm script mcp:smoke21
 *
 * Idempotent. Required gates:
 *  - node --check (server + smoke)
 *  - npm run build
 *  - npm run mcp:smoke21
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev === next) return false;
  fs.writeFileSync(p, next);
  return true;
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
if (!exists(serverPath)) throw new Error("Missing: " + serverPath);

let src = read(serverPath);

// ---- Patch 1: make toolsPayload deterministic (sorted by tool name) ----
{
  const anchor = "function toolsPayload() {";
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error("Anchor not found: " + anchor);

  // Replace entire function toolsPayload() { ... } block safely
  const re = /function toolsPayload\(\)\s*\{[\s\S]*?\n\}/m;
  if (!re.test(src)) throw new Error("Could not locate toolsPayload() block");

  const replacement = `function toolsPayload() {
  return Object.entries(TOOL_REGISTRY)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({
      name,
      version: v.version || "1.0.0",
      description: v.description || ""
    }));
}`;
  src = src.replace(re, replacement);
}

// ---- Patch 2: add contractVersion to /capabilities payload (stable contract marker) ----
{
  const re = /schema:\s*"mcp\.capabilities\.v1",/m;
  if (!re.test(src)) throw new Error('Expected capabilities schema line not found: schema: "mcp.capabilities.v1",');

  // Insert only once
  if (!src.includes('contractVersion: "21A.1.0",')) {
    src = src.replace(
      re,
      `schema: "mcp.capabilities.v1",\n      contractVersion: "21A.1.0",`
    );
  }
}

const didWrite = writeIfChanged(serverPath, src);
console.log(didWrite ? "Patched: " + serverPath : "No changes needed: " + serverPath);

// ---- Add smoke21 script ----
const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase21.mjs");
if (!exists(smokePath)) {
  const smoke = `#!/usr/bin/env node
/**
 * Phase 21A Smoke — Capabilities Contract
 * Validates:
 *  - /capabilities returns expected schema + contractVersion
 *  - requiredCtxFields, tenants, allowlists are stable
 *  - capabilities.tools matches /tools (names)
 *  - required toolset is present (12)
 */
import assert from "node:assert";

const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

async function getJson(path) {
  const r = await fetch(BASE + path);
  const status = r.status;
  const j = await r.json().catch(() => ({}));
  return { status, j };
}

function normNames(arr) {
  return (Array.isArray(arr) ? arr : [])
    .map((t) => (t && typeof t.name === "string" ? t.name : null))
    .filter(Boolean)
    .sort();
}

const REQUIRED_CTX = ["tenant", "actor", "purpose", "classification", "traceId"];
const TENANTS = ["shared", "chc", "ciag", "hospitality"];

const REQUIRED_TOOLS = [
  "shared.artifact_registry.read",
  "shared.artifact_registry.readById",
  "shared.artifact_registry.search",
  "chc.artifact_registry.read",
  "chc.artifact_registry.readById",
  "chc.artifact_registry.search",
  "ciag.artifact_registry.read",
  "ciag.artifact_registry.readById",
  "ciag.artifact_registry.search",
  "hospitality.artifact_registry.read",
  "hospitality.artifact_registry.readById",
  "hospitality.artifact_registry.search"
].slice().sort();

const EXPECT_ALLOW = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
};

(async () => {
  const cap = await getJson("/capabilities");
  assert.equal(cap.status, 200, "capabilities status");
  assert.equal(cap.j?.ok, true, "capabilities ok");
  assert.equal(cap.j?.schema, "mcp.capabilities.v1", "capabilities schema");
  assert.equal(cap.j?.contractVersion, "21A.1.0", "capabilities contractVersion");

  // ctx fields
  assert.deepEqual(cap.j?.requiredCtxFields, REQUIRED_CTX, "requiredCtxFields mismatch");

  // tenants
  assert.deepEqual(cap.j?.tenants, TENANTS, "tenants mismatch");

  // allowlists
  assert.deepEqual(cap.j?.namespaceAllowlistByTenant, EXPECT_ALLOW, "namespace allowlist mismatch");

  // tools must include required 12
  const capTools = normNames(cap.j?.tools);
  assert.equal(capTools.length, 12, "capabilities toolsCount != 12");
  assert.deepEqual(capTools, REQUIRED_TOOLS, "capabilities tools mismatch");

  // /tools must match capabilities.tools (names)
  const tools = await getJson("/tools");
  assert.equal(tools.status, 200, "tools status");
  assert.equal(tools.j?.ok, true, "tools ok");
  assert.equal(tools.j?.schema, "mcp.tools-registry.v1", "tools schema");
  const toolNames = normNames(tools.j?.tools);
  assert.deepEqual(toolNames, capTools, "/tools != /capabilities.tools");

  console.log(JSON.stringify({
    ok: true,
    phase: "21A",
    base: BASE,
    observed: { toolsCount: toolNames.length, contractVersion: cap.j?.contractVersion }
  }, null, 2));
})().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
`;
  writeIfChanged(smokePath, smoke);
  chmod755(smokePath);
  console.log("Added:", smokePath);
} else {
  console.log("Exists:", smokePath);
}

// ---- Add npm script mcp:smoke21 ----
const pkgPath = path.join(ROOT, "package.json");
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (pkg.scripts["mcp:smoke21"] !== "node scripts/mcp_smoke_phase21.mjs") {
  pkg.scripts["mcp:smoke21"] = "node scripts/mcp_smoke_phase21.mjs";
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched:", pkgPath, "(added mcp:smoke21)");
} else {
  console.log("No changes needed:", pkgPath, "(mcp:smoke21 present)");
}

// ---- Required gates ----
console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);
run("node --check " + smokePath);

console.log("== Running build (required gate) ==");
run("npm run build");

console.log("== Running smoke21 (required gate) ==");
run("npm run mcp:smoke21");
