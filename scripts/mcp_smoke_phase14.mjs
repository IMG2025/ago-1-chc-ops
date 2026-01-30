#!/usr/bin/env node
/**
 * mcp_smoke_phase14.mjs
 * Phase 14 smoke (CHC OPS):
 * - Verifies shared server /health and /tools
 * - Executes shared.artifact_registry.read / readById / search
 * - Uses ago-1-core/mcp (installed dependency) as the MCP client surface
 *
 * Base URL: MCP_SHARED_BASE (default http://127.0.0.1:8787)
 */
import { createHttpToolTransport, callTool } from "ago-1-core/mcp";

const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("NON_JSON: " + url + " => " + text.slice(0, 200)); }
  return { res, json };
}

async function main() {
  const h = await getJson(`${BASE}/health`);
  assert(h.res.ok, "health http not ok");
  assert(h.json?.ok === true, "health ok !== true");

  const t = await getJson(`${BASE}/tools`);
  assert(t.res.ok, "tools http not ok");
  assert(t.json?.ok === true, "tools ok !== true");
  assert(Array.isArray(t.json.tools), "tools.tools not array");

  const toolNames = t.json.tools.map(x => x?.name).filter(Boolean).sort();
  const required = [
    "shared.artifact_registry.read",
    "shared.artifact_registry.readById",
    "shared.artifact_registry.search"
  ].sort();

  for (const r of required) assert(toolNames.includes(r), "missing tool in /tools: " + r);

  const transport = createHttpToolTransport({ baseUrl: BASE });
  const ctx = {
    tenant: "shared",
    actor: "ago-1-chc-ops-smoke14",
    purpose: "phase14",
    classification: "internal",
    traceId: "chc-ops-phase14"
  };

  const r1 = await callTool(transport, { tool: "shared.artifact_registry.read", args: {}, ctx });
  assert(r1?.ok === true, "read ok !== true");
  assert(Array.isArray(r1.data?.artifacts), "read data.artifacts not array");

  const r2 = await callTool(transport, { tool: "shared.artifact_registry.readById", args: { id: "ECF-1" }, ctx });
  assert(r2?.ok === true, "readById ok !== true");
  assert(r2.data?.id === "ECF-1", "readById returned wrong id");
  assert(typeof r2.data?.schema === "string", "readById missing schema");

  const r3 = await callTool(transport, { tool: "shared.artifact_registry.search", args: { q: "AGO-1" }, ctx });
  assert(r3?.ok === true, "search ok !== true");
  assert(typeof r3.data?.count === "number", "search missing count");
  assert(Array.isArray(r3.data?.artifacts), "search artifacts not array");

  console.log(JSON.stringify({
    ok: true,
    phase: 14,
    base: BASE,
    tools: required,
    observed: {
      toolsCount: toolNames.length,
      readCount: r1.data.artifacts.length,
      searchCount: r3.data.count
    }
  }, null, 2));
}

main().catch((e) => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
