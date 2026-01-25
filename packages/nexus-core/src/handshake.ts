/**
 * Sentinel ↔ Nexus Handshake Contract (v1)
 *
 * Guardrails:
 * - Nexus does not import Sentinel internals.
 * - This is a stable DTO/port surface only.
 */
export type DomainId = string;
export type TaskType = string;

export type HandshakeRequest = Readonly<{
  domain_id: DomainId;
  task_type: TaskType;
  requested_scope?: readonly string[];
  task_fingerprint?: string;
}>;

export type HandshakeDecision = Readonly<{
  allowed: boolean;
  granted_scope?: readonly string[];
  reason_code?: string;
  reason_meta?: unknown;
}>;

export interface GovernanceGateway {
  authorize(req: HandshakeRequest): Promise<HandshakeDecision> | HandshakeDecision;
}
