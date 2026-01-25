export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

/**
 * Map from task type -> required scopes.
 * Partial: a domain may omit keys it does not support.
 * Readonly: contract is immutable once registered.
 */
export type RequiredScopes = Readonly<Partial<Record<TaskType, readonly string[]>>>;

export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;

  /** Which tasks this executor supports */
  supported_task_types: readonly TaskType[];

  /**
   * Scopes required to perform tasks (by type).
   * Partial is allowed to avoid forcing ESCALATE/ANALYZE for domains that don't implement them.
   */
  required_scopes: RequiredScopes;

  /**
   * Optional finer-grained scopes per action inside the domain.
   * Example: { "tariff:classify": ["scope:a", "scope:b"] }
   */
  domain_action_scopes?: Readonly<Record<string, readonly string[]>>;

  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;
