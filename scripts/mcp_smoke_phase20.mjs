#!/usr/bin/env node
import assert from "node:assert/strict";

function extractIdFromReadByIdResponse(j){
  // Supports:
  //  - { ok, data: { id } }
  //  - { ok, data: { artifact: { id } } }
  return j?.data?.id ?? j?.data?.artifact?.id;
}


function getIdFromReadById(resp){
  // authoritative contract: { ok:true, data:{ id, ... }, meta:{ traceId } }
  return resp?.data?.id;
}

function normalizeReadById(resp){
  // Accepts either full MCP response or already-unwrapped data
  if (!resp) return undefined;
  if (resp.id) return resp.id;          // already data
  if (resp.data?.id) return resp.data.id; // full response
  return undefined;
}



const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

async function getJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { status: r.status, j };
}

async function postTool(tool, tenant, args = {}) {
  const r = await fetch(`${BASE}/tool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tool,
      args,
      ctx: {
        tenant,
        actor: "smoke",
        purpose: "phase20",
        classification: "internal",
        traceId: "t-" + tenant + "-" + tool , contractVersion: "21A.1.0" }
    })
  });
  const j = await r.json();
  return { status: r.status, j };
}

(async () => {
  const { j: toolsJ } = await getJson(`${BASE}/tools`);
  const names = (toolsJ.tools || []).map(t => t.name);

  const required = [
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
  ];

  for (const t of required) assert(names.includes(t), "Missing tool: " + t);

  // Each tenant must resolve its seed marker via readById
  const checks = [
    ["chc", "TENANT-SEED-CHC"],
    ["ciag", "TENANT-SEED-CIAG"],
    ["hospitality", "TENANT-SEED-HOSPITALITY"]
  ];

  for (const [tenant, id] of checks) {
    const { status, j } = await postTool(`${tenant}.artifact_registry.readById`, tenant, { id });
    if (status !== 200) { console.error("DEBUG_SMOKE20_RESPONSE", JSON.stringify(j, null, 2)); }
assert.equal(status, 200, tenant + " readById status");
    assert.equal(j.ok, true, tenant + " ok");
    assert.equal(extractIdFromReadByIdResponse(j), id, tenant + " seed id mismatch");
  }

  // Search must return at least 1 result for "ECF"
  for (const tenant of ["chc","ciag","hospitality"]) {
    const { status, j } = await postTool(`${tenant}.artifact_registry.search`, tenant, { q: "ECF" });
    if (status !== 200) { console.error("DEBUG_SMOKE20_RESPONSE", JSON.stringify(j, null, 2)); }
assert.equal(status, 200, tenant + " search status");
    assert.equal(j.ok, true, tenant + " search ok");
    assert((j.data?.count ?? 0) >= 1, tenant + " search count < 1");
  }

  console.log(JSON.stringify({
    ok: true,
    phase: 20,
    base: BASE,
    observed: {
      requiredTools: required.length,
      toolsCount: names.length
    }
  }, null, 2));
})().catch((e) => {
  console.error("Error:", e?.stack || e);
  process.exit(1);
});
