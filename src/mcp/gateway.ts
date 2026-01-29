import type { ToolRequest, ToolResponse } from "./envelopes";
import { evaluateToolPolicy } from "./policy";

export type ToolTransport = (req: ToolRequest) => Promise<ToolResponse>;

/**
 * Nexus MCP Gateway (Phase 1 interface)
 * - Applies policy gate
 * - Delegates to a transport (HTTP/MCP SDK later)
 */
export async function callTool(transport: ToolTransport, req: ToolRequest): Promise<ToolResponse> {
  const t0 = Date.now();
  const policy = evaluateToolPolicy(req);
  if (!policy.allowed) {
    return {
      ok: false,
      error: { code: "POLICY_DENY", message: policy.reason ?? "Denied." },
      meta: { traceId: req.ctx.traceId, durationMs: Date.now() - t0 }
    };
  }

  const res = await transport(req);
  const durationMs = Date.now() - t0;

  // Normalize meta
  if ((res as any)?.meta?.traceId) {
    return { ...res, meta: { ...(res as any).meta, traceId: req.ctx.traceId, durationMs } } as ToolResponse;
  }
  return res;
}
