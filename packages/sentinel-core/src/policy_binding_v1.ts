/**
 * Sentinel Policy Execution Binding (v1)
 *
 * First-principles guardrails:
 * - Nexus must NOT own authorization semantics.
 * - Sentinel evaluates policy and emits a handshake-level decision.
 * - This binding provides a stable adapter surface for policy engines to plug into.
 * - Keep this surface minimal and audit-gated.
 */

import type { GovernanceGateway, HandshakeDecision, HandshakeRequest } from "./nexus_handshake_bridge_v1.js";
/** Minimal policy rule interface for v1. */
export type PolicyRule = Readonly<{
  id: string;
  name: string;
  /** Return true if this rule applies to the request. */
  applies: (req: HandshakeRequest) => boolean;
  /** Return the handshake decision (ALLOW/DENY/etc) using the canonical handshake contract. */
  decide: (req: HandshakeRequest) => HandshakeDecision;
}>;

export type PolicyEngine = Readonly<{
  /** Rules are evaluated in order; first match wins (v1). */
  rules: readonly PolicyRule[];
}>;

/**
 * Create a GovernanceGateway from a policy engine.
 * - v1 semantics: first matching rule decides; if none match, engine must provide a default rule.
 * - We intentionally do NOT inspect request shape here; rules do that.
 */
export function createGovernanceGatewayV1(engine: PolicyEngine): GovernanceGateway {
  if (!engine?.rules?.length) {
    const err = new Error("POLICY_ENGINE_EMPTY");
    // @ts-expect-error attach metadata
    err.code = "POLICY_ENGINE_EMPTY";
    throw err;
  }

  return {
    authorize(req: HandshakeRequest): HandshakeDecision {
      for (const r of engine.rules) {
        if (r.applies(req)) return r.decide(req);
      }
      // If we got here, the engine configuration is invalid for v1.
      const err = new Error("POLICY_NO_MATCH");
      // @ts-expect-error attach metadata
      err.code = "POLICY_NO_MATCH";
      // @ts-expect-error attach metadata
      err.meta = { rule_count: engine.rules.length };
      throw err;
    },
  };
}

// POLICY_BINDING_V1_LOCKED
