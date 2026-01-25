import type { ExecutorSpec } from "./contracts/executor.js";

/**
 * Authorization utilities for executor execution.
 * Pure functions. No globals. Deterministic.
 */

export type SupportedTaskType = ExecutorSpec["supported_task_types"][number];

export function isTaskSupported(spec: ExecutorSpec, task: SupportedTaskType): boolean {
  return Array.isArray(spec.supported_task_types) && spec.supported_task_types.includes(task);
}

/**
 * required_scopes can be absent or partial; treat missing key as "no required scopes".
 * required_scopes[task] is an array of acceptable scopes.
 */
export function isScopeSatisfied(
  spec: ExecutorSpec,
  task: SupportedTaskType,
  scope: string
): boolean {
  const rs: any = (spec as any).required_scopes;
  if (!rs || typeof rs !== "object") return true;

  const allowed = rs[task];
  if (!allowed) return true;

  if (!Array.isArray(allowed)) return false;
  return allowed.includes(scope);
}

export function assertAuthorized(
  spec: ExecutorSpec,
  task: SupportedTaskType,
  scope: string
): void {
  if (!isTaskSupported(spec, task)) {
  // Sentinel invariant: every supported task type must define required scopes
  const missing = spec.supported_task_types.filter(
    t => !spec.required_scopes || !spec.required_scopes[t]
  );

  if (missing.length > 0) {
    throw new Error(
      `MISSING_REQUIRED_SCOPES_FOR_TASKS:${missing.join(",")}`
    );
  }

    throw new Error(`UNSUPPORTED_TASK_TYPE:${spec.domain_id}:${spec.executor_id}:${task}`);
  }
  if (!isScopeSatisfied(spec, task, scope)) {
    throw new Error(`MISSING_REQUIRED_SCOPE:${spec.domain_id}:${spec.executor_id}:${task}:${scope}`);
  }
}
