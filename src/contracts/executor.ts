export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;
  supported_task_types: readonly TaskType[];
  required_scopes: Readonly<Record<TaskType, readonly string[]>>;
  domain_action_scopes?: Readonly<Record<string, readonly string[]>>;
  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;
