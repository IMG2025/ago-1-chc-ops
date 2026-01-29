/**
 * MCP Phase 3 — Compile-Time Proof
 *
 * This file intentionally does NOT execute at runtime.
 * It proves that CHC Ops can construct a valid MCP tool call
 * using Nexus gateway + transport types.
 */

import { callTool } from "./gateway";
import { createHttpToolTransport } from "./transports/httpTransport";
import type { ToolRequest } from "./envelopes";

export function mcpPhase3CompileProof() {
  const transport = createHttpToolTransport({ baseUrl: "http://127.0.0.1:8787" });

  const req: ToolRequest = {
    tool: "shared.artifact_registry.read",
    args: {},
    ctx: {
      tenant: "shared",
      actor: "ago-1-chc-ops",
      purpose: "phase3-compile-proof",
      classification: "internal",
      traceId: "compile-proof"
    }
  };

  // We do not execute this at runtime.
  // The type system validates the call shape and policy surface.
  void callTool(transport, req);
}
