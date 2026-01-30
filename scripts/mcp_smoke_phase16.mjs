#!/usr/bin/env node
/**
 * Phase 16 smoke: validate /capabilities endpoint + contract
 */
const BASE = process.env.MCP_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function getJson(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  assert(res.ok, `${path} => HTTP ${res.status}`);
  assert(json && typeof json === "object", `${path} => JSON body required`);
  return json;
}

function sorted(xs) { return [...xs].sort(); }

(async () => {
  const health = await getJson("/health");
  assert(health.ok === true, "/health ok");
  assert(health.service === "mcp-shared-server", "/health service");

  const tools = await getJson("/tools");
  assert(tools.ok === true, "/tools ok");
  const toolNames = (tools.tools || []).map(t => t.name);
  for (const name of ["shared.artifact_registry.read","shared.artifact_registry.readById","shared.artifact_registry.search"]) {
    assert(toolNames.includes(name), "/tools includes " + name);
  }

  const cap = await getJson("/capabilities");
  assert(cap.ok === true, "/capabilities ok");
  assert(cap.schema === "mcp.capabilities.v1", "/capabilities schema");
  const req = cap.requiredCtxFields || [];
  for (const f of ["tenant","actor","purpose","classification","traceId"]) {
    assert(req.includes(f), "/capabilities requiredCtxFields includes " + f);
  }

  const capToolNames = (cap.tools || []).map(t => t.name);
  // Capabilities must include all required tools.
  for (const name of ["shared.artifact_registry.read","shared.artifact_registry.readById","shared.artifact_registry.search"]) {
    assert(capToolNames.includes(name), "/capabilities includes " + name);
  }

  // Optional consistency check: /tools and /capabilities sets match at least on required tools
  console.log(JSON.stringify({
    ok: true,
    phase: 16,
    base: BASE,
    observed: {
      tools: sorted(toolNames),
      capabilitiesTools: sorted(capToolNames),
      requiredTools: ["shared.artifact_registry.read","shared.artifact_registry.readById","shared.artifact_registry.search"]
    }
  }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
