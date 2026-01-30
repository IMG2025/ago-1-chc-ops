#!/usr/bin/env node
// Phase 11 MCP smoke: tools registry contract + policy gates
const BASE = process.env.MCP_SHARED_BASE_URL || "http://127.0.0.1:8787";

async function jget(url) {
  const r = await fetch(url);
  const t = await r.text();
  try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: null, text: t }; }
}
async function jpost(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: null, text: t }; }
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

(async () => {
  // 1) tools contract
  const tools = await jget(`${BASE}/tools`);
  assert(tools.status === 200, "/tools status 200");
  assert(tools.json?.ok === true, "/tools ok true");
  assert(tools.json?.schema === "mcp.tools-registry.v1", "/tools schema");
  assert(Array.isArray(tools.json?.requiredCtxFields), "requiredCtxFields array");
  assert(Array.isArray(tools.json?.tools), "tools array");
  const names = tools.json.tools.map(t => t.name).sort();
  for (const required of ["shared.artifact_registry.read", "shared.artifact_registry.readById", "shared.artifact_registry.search"]) {
    assert(names.includes(required), "tool present: " + required);
  }

  // 2) happy-path call: search
  const okReq = {
    tool: "shared.artifact_registry.search",
    args: { q: "ECF" },
    ctx: { tenant: "shared", actor: "smoke", purpose: "phase11", classification: "internal", traceId: "smoke-11-ok" }
  };
  const okRes = await jpost(`${BASE}/tool`, okReq);
  assert(okRes.status === 200, "search status 200");
  assert(okRes.json?.ok === true, "search ok true");
  assert(okRes.json?.data?.schema === "artifact-registry.search.v1", "search response schema");
  assert(okRes.json?.meta?.traceId === "smoke-11-ok", "meta.traceId propagated");

  // 3) missing ctx field => 400 BAD_REQUEST
  const badReq = { tool: "shared.artifact_registry.read", args: {}, ctx: { tenant: "shared" } };
  const badRes = await jpost(`${BASE}/tool`, badReq);
  assert(badRes.status === 400, "missing ctx => 400");
  assert(badRes.json?.ok === false, "missing ctx ok false");
  assert(badRes.json?.error?.code === "BAD_REQUEST", "missing ctx BAD_REQUEST");

  // 4) forbidden namespace => 403 FORBIDDEN
  const forbidReq = {
    tool: "chc.secret.read",
    args: {},
    ctx: { tenant: "shared", actor: "smoke", purpose: "phase11", classification: "internal", traceId: "smoke-11-forbid" }
  };
  const forbidRes = await jpost(`${BASE}/tool`, forbidReq);
  assert(forbidRes.status === 403, "forbidden => 403");
  assert(forbidRes.json?.error?.code === "FORBIDDEN", "forbidden FORBIDDEN");
  assert(forbidRes.json?.meta?.traceId === "smoke-11-forbid", "forbidden meta.traceId");

  // 5) unknown tool in allowed namespace => 404 TOOL_NOT_FOUND
  const nfReq = {
    tool: "shared.nope",
    args: {},
    ctx: { tenant: "shared", actor: "smoke", purpose: "phase11", classification: "internal", traceId: "smoke-11-404" }
  };
  const nfRes = await jpost(`${BASE}/tool`, nfReq);
  assert(nfRes.status === 404, "unknown => 404");
  assert(nfRes.json?.error?.code === "TOOL_NOT_FOUND", "unknown TOOL_NOT_FOUND");
  assert(nfRes.json?.meta?.traceId === "smoke-11-404", "unknown meta.traceId");

  console.log(JSON.stringify({ ok: true, phase: 11, base: BASE, tools: names }, null, 2));
})().catch((e) => {
  console.error(e?.stack || e?.message || String(e));
  process.exit(1);
});
