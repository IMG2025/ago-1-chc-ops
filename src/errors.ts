export type CHCOpsErrorCode =
  | "UNKNOWN_DOMAIN"
  | "UNSUPPORTED_TASK_TYPE"
  | "MISSING_SCOPE"
  | "MISSING_ACTION_SCOPE"
  | "INVALID_TASK";

export type CHCOpsError = Error & {
  code: CHCOpsErrorCode;
  meta?: Record<string, unknown>;
};

export function chcOpsError(code: CHCOpsErrorCode, meta?: Record<string, unknown>): CHCOpsError {
  const e = new Error(code) as CHCOpsError;
  e.code = code;
  if (meta) e.meta = meta;
  return e;
}

export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export function isTaskType(x: unknown): x is TaskType {
  return x === "EXECUTE" || x === "ANALYZE" || x === "ESCALATE";
}

/**
 * Extracts a TaskType from arbitrary task input.
 * Supports:
 *  - string task type
 *  - { type: "EXECUTE" | ... }
 *  - { task_type: "EXECUTE" | ... }
 */
export function getTaskType(task: unknown): TaskType {
  if (isTaskType(task)) return task;

  if (task && typeof task === "object") {
    const anyTask = task as any;
    if (isTaskType(anyTask.type)) return anyTask.type;
    if (isTaskType(anyTask.task_type)) return anyTask.task_type;
  }

  throw chcOpsError("INVALID_TASK", { task });
}
