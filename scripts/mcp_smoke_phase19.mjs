#!/usr/bin/env node
/**
 * Phase 19 smoke:
 * - Ensure tenant registry files exist + include tenant seed marker
 * - Ensure tenant tools read tenant-specific registries (marker must be present)
 */
import { strict as assert } from "node:assert";

const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

async function jget(p) {
  const res = await fetch(`${BASE}${p}`);
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { throw new Error(`Non-JSON from ${p}: ${txt}`); }
}

async function jtool(tool, ctx, args = {}) {
  const res = await fetch(`${BASE}/tool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args, ctx })
  });
  const body = await res.json();
  return { status: res.status, body };
}

function ctx(tenant, traceId) {
  return {
    tenant,
    actor: "smoke",
    purpose: "phase19",
    classification: "internal",
    traceId
  };
}

function expectMarker(tenant, artifacts) {
  const id = `TENANT-SEED-${tenant.toUpperCase()}`;
  assert.ok(Array.isArray(artifacts), "artifacts must be array");
  assert.ok(artifacts.some(a => a && a.id === id), `missing marker ${id}`);
}

(async () => {
  // tools + capabilities should list tenant tools
  const tools = await jget("/tools");
  assert.equal(tools.ok, true);
  const names = (tools.tools || []).map(t => t.name).sort();

  for (const required of [
    "shared.artifact_registry.read",
    "shared.artifact_registry.readById",
    "shared.artifact_registry.search",
    "chc.artifact_registry.read",
    "ciag.artifact_registry.read",
    "hospitality.artifact_registry.read",
  ]) {
    assert.ok(names.includes(required), `missing ${required} from /tools`);
  }

  // tenant reads must include tenant marker
  const tenants = [
    ["chc", "chc.artifact_registry.read"],
    ["ciag", "ciag.artifact_registry.read"],
    ["hospitality", "hospitality.artifact_registry.read"],
  ];

  for (const [tenant, tool] of tenants) {
    const { status, body } = await jtool(tool, ctx(tenant, `t-${tenant}`), {});
    assert.equal(status, 200, `expected 200 for ${tool}, got ${status}`);
    assert.equal(body.ok, true);
    expectMarker(tenant, body.data?.artifacts || []);
  }

  // shared tool should NOT include tenant markers (contract: shared registry remains global)
  {
    const { status, body } = await jtool("shared.artifact_registry.read", ctx("shared", "t-shared"), {});
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    const arts = body.data?.artifacts || [];
    const forbidden = ["TENANT-SEED-CHC", "TENANT-SEED-CIAG", "TENANT-SEED-HOSPITALITY"];
    for (const f of forbidden) {
      assert.ok(!arts.some(a => a && a.id === f), `shared registry must not contain ${f}`);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    phase: 19,
    base: BASE,
    observed: {
      toolsCount: names.length,
      tools: names
    }
  }, null, 2));
})().catch((e) => {
  console.error("Error:", e?.stack || e?.message || String(e));
  process.exit(1);
});
