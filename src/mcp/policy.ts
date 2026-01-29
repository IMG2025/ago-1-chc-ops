import type { ToolRequest } from "./envelopes";

/**
 * Sentinel-facing policy hook.
 * Phase 1: allow only shared.* tools.
 * Anything else is default-deny.
 */
export function evaluateToolPolicy(req: ToolRequest): { allowed: boolean; reason?: string } {
  if (req.tool.startsWith("shared.")) return { allowed: true };
  return { allowed: false, reason: "Tool not allowlisted (default-deny)." };
}
