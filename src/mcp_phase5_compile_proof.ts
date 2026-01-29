/**
 * CHC Ops Phase 5 — Compile-Time Proof (MCP via ago-1-core)
 *
 * This file intentionally does NOT execute at runtime.
 * It proves CHC Ops can build a valid MCP tool request using the core Nexus plane.
 */
import { mcp } from "ago-1-core";

export function chcOpsMcpCompileProof() {
  const transport = mcp.createHttpToolTransport({ baseUrl: "http://127.0.0.1:8787" });

  const req: mcp.ToolRequest = {
    tool: "shared.artifact_registry.read",
    args: {},
    ctx: {
      tenant: "shared",
      actor: "ago-1-chc-ops",
      purpose: "chc-ops-phase5-compile-proof",
      classification: "internal",
      traceId: "chc-ops-compile-proof"
    }
  };

  void mcp.callTool(transport, req);
}
