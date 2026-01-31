#!/usr/bin/env node
/**
 * Smoke 21C — tool-level minContractVersion gating + window support.
 * Expects server running on 127.0.0.1:8787
 */
import assert from "node:assert";

const CLIENT_CONTRACT_VERSION = "0.0.0";
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
    assert.equal(r.status, 409, "tool-min pass blocked (search gated)");
    assert.equal(r.j.ok, false, "tool-min correctly gated");
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
