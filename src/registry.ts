export interface ExecutorRegistry {
  registerExecutor(spec: ExecutorSpec): void;
}

export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;
  supported_task_types: readonly ("EXECUTE" | "ANALYZE" | "ESCALATE")[];
  required_scopes: Readonly<Partial<Record<"EXECUTE" | "ANALYZE" | "ESCALATE", readonly string[]>>>;
  domain_action_scopes?: Readonly<Record<string, readonly string[]>>;
  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;

export class DomainRegistry {
  private readonly byDomain = new Map<string, ExecutorSpec>();

  registerExecutor(spec: ExecutorSpec): void {
    if (this.byDomain.has(spec.domain_id)) {
      throw new Error(`DUPLICATE_EXECUTOR_FOR_DOMAIN:${spec.domain_id}`);
    }
    this.byDomain.set(spec.domain_id, spec);
  }

  get(domain_id: string): ExecutorSpec | undefined {
    return this.byDomain.get(domain_id);
  }

  listDomains(): readonly string[] {
    return Array.from(this.byDomain.keys()).sort();
  }
}

export function createRegistry(): ExecutorRegistry {
  return new DomainRegistry();
}
