// Canonical Public Surface (v1)
// NOTE: This file is composed. Do not overwrite handshake exports.
export type {
  DomainId,
  ExecutorId,
  TaskType,
  TaskEnvelope,
  OrchestrationResult,
  ExecutorAdapter,
  RoutingPolicy,
  Orchestrator,
} from "./orchestration.js";

export { defaultRoutingPolicy } from "./orchestration.js";
export { NexusOrchestrator } from "./orchestrator_v1.js";

// Handshake surface (explicit; audit-gated)
export type { GovernanceGateway, HandshakeDecision, HandshakeRequest } from "./handshake.js";
// HANDSHAKE_EXPORTS_EXPLICIT
