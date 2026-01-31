#!/usr/bin/env node
/**
 * Phase 21B Smoke
 * Verifies ctx.contractVersion is REQUIRED and ENFORCED
 */
import assert from "node:assert";

const BASE = process.env.MCP_BASE || "http://127.0.0.1:8787";

async function post(tool, ctx, args = {}) {
  const res = await fetch(`${BASE}/tool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args, ctx })
  });
  const j = await res.json();
  return { status: res.status, j };
}

(async () => {
  // ---- Missing contractVersion must fail ----
  {
    const { status } = await post(
      "shared.artifact_registry.read",
      {
        tenant: "shared",
        actor: "smoke21b",
        purpose: "contract-enforcement",
        classification: "internal",
        traceId: "t-21b-missing"
      }
    );
    assert.equal(status, 400, "missing contractVersion must 400");
  }

  // ---- Wrong contractVersion must fail ----
  {
    const { status } = await post(
      "shared.artifact_registry.read",
      {
        tenant: "shared",
        actor: "smoke21b",
        purpose: "contract-enforcement",
        classification: "internal",
        traceId: "t-21b-wrong",
        contractVersion: "0.0.0"
      }
    );
    assert.equal(status, 409, "wrong contractVersion must 409");
  }

  // ---- Correct contractVersion must pass ----
  const { status, j } = await post(
    "shared.artifact_registry.read",
    {
      tenant: "shared",
      actor: "smoke21b",
      purpose: "contract-enforcement",
      classification: "internal",
      traceId: "t-21b-ok",
      contractVersion: "21A.1.0"
    }
  );

  assert.equal(status, 200, "correct contractVersion must succeed");
  assert.equal(j.ok, true);

  console.log(JSON.stringify({
    ok: true,
    phase: "21B",
    base: BASE,
    enforced: true
  }, null, 2));
})();
