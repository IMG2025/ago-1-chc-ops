#!/usr/bin/env node
import { createHttpToolTransport, callTool } from "ago-1-core/mcp";

async function main() {
  const baseUrl = process.env.MCP_BASE_URL || "http://127.0.0.1:8787";

  // health check
  const health = await fetch(`${baseUrl}/health`).then(r => r.json());
  if (!health?.ok) {
    console.error("MCP health check failed:", health);
    process.exit(1);
  }

  const transport = createHttpToolTransport({ baseUrl });

  const req = {
    tool: "shared.artifact_registry.read",
    args: {},
    ctx: {
      tenant: "shared",
      actor: "chc-ops-smoke",
      purpose: "phase6",
      classification: "internal",
      traceId: "chc-ops-phase6"
    }
  };

  const res = await callTool(transport, req);
  console.log(JSON.stringify(res));

  if (!res?.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
