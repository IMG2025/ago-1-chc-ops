import type { ExecutorSpec, TaskType } from "@chc/sentinel-core";

/**
 * Nexus Core (v0): orchestration contract.
 * This is intentionally minimal: we define the shape we will grow into.
 */
export type OrchestrationRequest = Readonly<{
  domain_id: string;
  task_type: TaskType;
  input: unknown;
  scopes: readonly string[];
}>;

export type OrchestrationResult = Readonly<{
  ok: true;
  output: unknown;
}> | Readonly<{
  ok: false;
  code: string;
  meta?: Record<string, unknown>;
}>;

/**
 * A registry surface Nexus expects.
 * Sentinel-core implements a compatible registry; we keep Nexus decoupled.
 */
export type ExecutorLookup = (domain_id: string) => ExecutorSpec | undefined;

/**
 * Minimal orchestrate function (no runtime coupling yet).
 * We will replace this with policy-driven routing + audit trails.
 */
export function orchestrate(getExecutor: ExecutorLookup, req: OrchestrationRequest): OrchestrationResult {
  const spec = getExecutor(req.domain_id);
  if (!spec) return { ok: false, code: "UNKNOWN_DOMAIN", meta: { domain_id: req.domain_id } };
  // NOTE: no execution here yet; Nexus will route to domain executors later.
  return { ok: true, output: { routed: spec.executor_id, task_type: req.task_type } };
}
