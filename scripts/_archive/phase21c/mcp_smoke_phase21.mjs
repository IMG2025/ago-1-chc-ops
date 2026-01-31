#!/usr/bin/env node
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
