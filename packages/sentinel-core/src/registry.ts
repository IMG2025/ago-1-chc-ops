// --- type branding (authorize hardening) ---
type Brand<K, T> = K & { __brand: T };
type DomainId = Brand<string, "DomainId">;
type ScopeString = Brand<string, "ScopeString">;
type TaskTypeId = Brand<string, "TaskTypeId">;
// --- end branding ---


import { chcOpsError, getTaskType } from "./errors.js";

function validateScopeNamespaces(spec: ExecutorSpec) {
  const domain = spec.domain_id;

  // Task-type required scopes must exist and be domain-scoped.
  for (const t of spec.supported_task_types) {
    const scopes = spec.required_scopes?.[t] ?? [];
    if (!Array.isArray(scopes) || scopes.length === 0) {
      const err: any = new Error("MISSING_REQUIRED_SCOPES");
      err.code = "MISSING_REQUIRED_SCOPES";
      err.meta = { domain_id: domain, task_type: t, required_scopes: scopes, note: "required_scopes must be declared for all supported_task_types" };
      throw err;
    }
    for (const s of scopes) {
      if (typeof s !== "string" || !s.startsWith(domain + ":")) {
        const err: any = new Error("INVALID_SCOPE_NAMESPACE");
        err.code = "INVALID_SCOPE_NAMESPACE";
        err.meta = { domain_id: domain, task_type: t, scope: s, note: "task required_scopes must be namespaced as <domain_id>:*" };
        throw err;
      }
    }
  }

  // Domain-action scopes must also be domain-scoped.
  const actions = spec.domain_action_scopes ?? {};
  for (const [action, scopes] of Object.entries(actions)) {
    for (const s of scopes ?? []) {
      if (typeof s !== "string" || !s.startsWith(domain + ":")) {
        const err: any = new Error("INVALID_SCOPE_NAMESPACE");
        err.code = "INVALID_SCOPE_NAMESPACE";
        err.meta = { domain_id: domain, action, scope: s, note: "domain_action_scopes must be namespaced as <domain_id>:*" };
        throw err;
      }
    }
  }
}


// ACTION_SCOPES_SUBSET_GATE:
// Sentinel-aligned: every domain_action_scopes entry must be in the allowed required_scopes universe.
function validateActionScopesSubset(spec: ExecutorSpec) {
  const domain = spec.domain_id;

  // Build allowlist = union of all required_scopes across supported_task_types.
  const allow = new Set<string>();
  for (const t of spec.supported_task_types) {
    const scopes = spec.required_scopes?.[t] ?? [];
    for (const s of scopes ?? []) allow.add(s);
  }

  const actions = spec.domain_action_scopes ?? {};
  for (const [action, scopes] of Object.entries(actions)) {
    for (const s of (scopes ?? [])) {
      // Namespacing is already validated separately, but keep this defensive.
      if (typeof s !== "string" || !s.startsWith(domain + ":")) {
        throw chcOpsError("INVALID_SCOPE_NAMESPACE", {
          domain_id: domain,
          action,
          scope: s,
          note: "domain_action_scopes must be namespaced as <domain_id>:*",
        });
      }
      if (!allow.has(s)) {
        throw chcOpsError("ACTION_SCOPE_NOT_ALLOWED", {
          domain_id: domain,
          action,
          scope: s,
          allowed_scopes: Array.from(allow).sort(),
          note: "domain_action_scopes must be a subset of required_scopes (union across supported_task_types).",
        });
      }
    }
  }
}


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
    validateScopeNamespaces(spec);
    validateActionScopesSubset(spec);
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
  /**
   * Sentinel-aligned gate: validates task support + required scope.
   * Deterministic. Throws with stable error codes.
   */

  /**
   * Sentinel-aligned gate: validates task support + required scopes.
   * Deterministic. Throws with stable CHC Ops error codes.
   */
  authorize(
  domain_id: DomainId,
  task: unknown,
  scope: ScopeString
): void {
  const taskType = getTaskType(task);


    // RUNTIME_AUTH_HARDENING_GATE:
    // Defense-in-depth: re-assert spec invariants at decision time.
    const spec = this.byDomain.get(domain_id);
    if (!spec) {
      throw chcOpsError("UNKNOWN_DOMAIN", { domain_id });
    }

    validateScopeNamespaces(spec);
    validateActionScopesSubset(spec);

    if (typeof scope !== "string" || !scope.startsWith(domain_id + ":")) {
      throw chcOpsError("INVALID_SCOPE_NAMESPACE", {
        domain_id,
        task_type: taskType,
        scope,
        note: "scope must be namespaced as <domain_id>:*",
      });
    }
    // 1) Task type must be supported by this domain executor
    if (!spec.supported_task_types.includes(taskType)) {
      throw chcOpsError("UNSUPPORTED_TASK_TYPE", {
        domain_id,
        task_type: taskType,
        supported_task_types: spec.supported_task_types,
      });
    }

    // 2) Scope must be present in required_scopes[taskType] if defined
    const scopesForType = spec.required_scopes?.[taskType];
    if (Array.isArray(scopesForType) && scopesForType.length > 0) {
      if (!scopesForType.includes(scope)) {
        throw chcOpsError("MISSING_SCOPE", {
          domain_id,
          task_type: taskType,
          scope,
          required_scopes: scopesForType,
        });
      }
    } else {
      // If the domain says it supports the task type but doesn't define scopes for it,
      // treat it as a policy misconfig: require explicit allowlist.
      throw chcOpsError("MISSING_SCOPE", {
        domain_id,
        task_type: taskType,
        scope,
        required_scopes: scopesForType ?? [],
        note: "No required_scopes configured for this task_type.",
      });
    }
  }

}


export function createRegistry(): ExecutorRegistry {
  return new DomainRegistry();

  }
