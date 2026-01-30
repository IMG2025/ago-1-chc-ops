#!/usr/bin/env node
const BASE = process.env.MCP_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function getJson(p) {
  const r = await fetch(BASE + p);
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = null; }
  assert(j && typeof j === "object", p + " => JSON body");
  return { status: r.status, ok: r.ok, json: j, raw: t };
}

function sorted(xs) { return [...xs].sort(); }

async function postTool(body) {
  const r = await fetch(BASE + "/tool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const t = await r.text();
  let j;
  try { j = JSON.parse(t); } catch { j = null; }
  return { status: r.status, ok: r.ok, json: j, raw: t };
}

(async () => {
  const caps = await getJson("/capabilities");
  assert(caps.ok, "/capabilities HTTP ok");
  assert(caps.json.schema === "mcp.capabilities.v1", "/capabilities schema");
  const capNames = (caps.json.tools || []).map(t => t.name);

  const tools = await getJson("/tools");
  assert(tools.ok, "/tools HTTP ok");
  assert(tools.json.schema === "mcp.tools-registry.v1", "/tools schema");
  const toolNames = (tools.json.tools || []).map(t => t.name);

  assert(JSON.stringify(sorted(toolNames)) === JSON.stringify(sorted(capNames)), "/tools and /capabilities tool sets match");

  // Policy: missing ctx => 400
  const miss = await postTool({ tool: "shared.artifact_registry.read", args: {}, ctx: { tenant: "shared" } });
  assert(miss.status === 400, "missing ctx fields => 400");

  // Policy: forbidden namespace => 403 (valid ctx, tool prefix not allowed)
  const forbid = await postTool({
    tool: "chc.secret.read",
    args: {},
    ctx: { tenant: "shared", actor: "smoke", purpose: "phase17", classification: "internal", traceId: "t-forbid17" }
  });
  assert(forbid.status === 403, "forbidden namespace => 403");

  // Policy: unknown tool in allowed namespace => 404
  const notFound = await postTool({
    tool: "shared.nope",
    args: {},
    ctx: { tenant: "shared", actor: "smoke", purpose: "phase17", classification: "internal", traceId: "t-404-17" }
  });
  assert(notFound.status === 404, "unknown tool => 404");

  console.log(JSON.stringify({
    ok: true,
    phase: 17,
    base: BASE,
    observed: {
      toolsCount: toolNames.length,
      capCount: capNames.length,
      tools: sorted(toolNames)
    }
  }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
