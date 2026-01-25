/**
 * Nexus Orchestration Contract (v1)
 *
 * First-principles guardrails:
 * - Nexus orchestrates tasks; it does NOT own authorization semantics.
 * - Nexus may consult a governance gateway (Sentinel) via handshake contracts,
 *   but MUST remain usable in isolation for testing.
 * - This contract is intentionally minimal and stable.
 */

export type DomainId = string;
export type ExecutorId = string;
export type TaskType = string;

/**
 * Canonical task envelope for orchestration.
 * Nexus owns this structure.
 */
export type TaskEnvelope<TInput = unknown> = Readonly<{
  task_id: string;
  domain_id: DomainId;
  task_type: TaskType;
  requested_scope?: readonly string[]; // optional: requested scopes (governance decides)
  input: TInput;
  created_at: string; // ISO
}>;

/**
 * Canonical orchestration result.
 * Nexus returns a stable response shape regardless of executor.
 */
export type OrchestrationResult<TOutput = unknown> = Readonly<{
  task_id: string;
  domain_id: DomainId;
  task_type: TaskType;
  status: "SUCCEEDED" | "FAILED";
  output?: TOutput;
  error_code?: string;
  error_meta?: unknown;
  finished_at: string; // ISO
}>;

/**
 * Executor adapter contract.
 * Nexus routes envelopes to an executor implementation.
 */
export type ExecutorAdapter = Readonly<{
  executor_id: ExecutorId;
  domain_id: DomainId;
  supported_task_types: readonly TaskType[];
  execute: (envelope: TaskEnvelope) => Promise<unknown> | unknown;
}>;

/**
 * Routing policy contract.
 * Given an envelope and a set of adapters, select the executor.
 * This is deterministic and testable.
 */
export type RoutingPolicy = (args: Readonly<{
  envelope: TaskEnvelope;
  adapters: readonly ExecutorAdapter[];
}>) => ExecutorAdapter;

/**
 * Orchestrator contract.
 * Minimal: register adapters, route, dispatch, produce OrchestrationResult.
 */
export interface Orchestrator {
  registerAdapter(adapter: ExecutorAdapter): void;
  listAdapters(): readonly ExecutorAdapter[];
  route(envelope: TaskEnvelope): ExecutorAdapter;
  dispatch(envelope: TaskEnvelope): Promise<OrchestrationResult>;
}

/**
 * Default routing policy (v1):
 * - Choose first adapter that matches domain_id + supports task_type.
 * - Deterministic, minimal, safe.
 */
export const defaultRoutingPolicy: RoutingPolicy = ({ envelope, adapters }) => {
  const hit = adapters.find(
    a => a.domain_id === envelope.domain_id && a.supported_task_types.includes(envelope.task_type)
  );
  if (!hit) {
    const err: any = new Error("NO_ROUTE");
    err.code = "NO_ROUTE";
    err.meta = {
      domain_id: envelope.domain_id,
      task_type: envelope.task_type,
      adapters: adapters.map(a => ({ executor_id: a.executor_id, domain_id: a.domain_id, supported_task_types: a.supported_task_types })),
    };
    throw err;
  }
  return hit;
};
