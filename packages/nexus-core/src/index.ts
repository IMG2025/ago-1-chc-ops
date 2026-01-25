// Canonical Public Surface (v1)
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

export type { HandshakeRequest, HandshakeDecision } from "./handshake.js";
export type { GovernanceGateway } from "./handshake.js";
// handshake-audit-required: Handshake | GovernanceGateway
