/**
 * Nexus Handshake Bridge Types (v1) — Termux compile bridge
 *
 * Purpose:
 * - Termux npm cannot reliably install/link workspace packages.
 * - We still need Sentinel to compile while referencing handshake contract types.
 *
 * Guardrails:
 * - This file MUST mirror nexus-core handshake types exactly (v1).
 * - It is temporary infrastructure until workspace linking is stable.
 * - Do NOT add business logic here. Types only.
 */

// NOTE: Mirror of @chc/nexus-core handshake contract (v1)

export type HandshakeRequest = Readonly<{
  domain_id: string;
  task_type: string;
  requested_scope?: readonly string[];
  actor: Readonly<{
    subject_id: string;
    role: string;
    tenant_id?: string;
  }>;
}>;

export type HandshakeDecision = Readonly<{
  decision: "ALLOW" | "DENY";
  reason_code?: string;
  reason_meta?: unknown;
  issued_at: string; // ISO
}>;

export type GovernanceGateway = Readonly<{
  authorize: (req: HandshakeRequest) => HandshakeDecision;
}>;

// NEXUS_HANDSHAKE_BRIDGE_V1_LOCKED
