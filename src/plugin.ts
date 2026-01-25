import type { RegisterExecutorFn } from "./contracts/registry.js";
import { hospitalityExecutorSpec } from "./executors.js";import type { DomainRegistry } from "./registry.js";

export function registerHospitality(register: RegisterExecutorFn): void {
  register(hospitalityExecutorSpec);
}

/**
 * CHC Ops compatibility mount.
 * Do NOT remove — consumed by diagnostics/ops tooling.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  const register = registry.registerExecutor.bind(registry) as unknown as RegisterExecutorFn;
  registerHospitality(register);
}
