#!/usr/bin/env bash
set -euo pipefail

FILE="src/authorize.ts"

if [ ! -f "$FILE" ]; then
  cat > "$FILE" <<'TS'
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
    throw new Error(`UNSUPPORTED_TASK_TYPE:${spec.domain_id}:${spec.executor_id}:${task}`);
  }
  if (!isScopeSatisfied(spec, task, scope)) {
    throw new Error(`MISSING_REQUIRED_SCOPE:${spec.domain_id}:${spec.executor_id}:${task}:${scope}`);
  }
}
TS
else
  # If file exists, ensure it has the key export we require. If not, append minimal shim.
  if ! grep -q "export function assertAuthorized" "$FILE"; then
    cat >> "$FILE" <<'TS'

/** Backfill: assertAuthorized missing; added by script. */
export function assertAuthorized(spec: ExecutorSpec, task: SupportedTaskType, scope: string): void {
  if (!isTaskSupported(spec, task)) {
    throw new Error(`UNSUPPORTED_TASK_TYPE:${spec.domain_id}:${spec.executor_id}:${task}`);
  }
  if (!isScopeSatisfied(spec, task, scope)) {
    throw new Error(`MISSING_REQUIRED_SCOPE:${spec.domain_id}:${spec.executor_id}:${task}:${scope}`);
  }
}
TS
  fi
fi

# Ensure index exports authorize module (idempotent)
INDEX="src/index.ts"
if [ -f "$INDEX" ]; then
  if ! grep -q 'from "./authorize.js"' "$INDEX"; then
    printf '\nexport * from "./authorize.js";\n' >> "$INDEX"
  fi
fi

npm run build
