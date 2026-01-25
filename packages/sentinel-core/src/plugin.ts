import type { DomainRegistry } from "./registry.js";
import type { RegisterExecutorFn } from "./contracts/registry.js";
import { hospitalityExecutorSpec } from "./executors.js";
export function registerHospitality(register: RegisterExecutorFn): void {
  register(hospitalityExecutorSpec);
}

/**
 * CHC Ops compatibility alias.
 * Do NOT remove — consumed by diagnostics and ops tooling.
 */
export const mountCHCOpsPlugins = registerHospitality;

/**
 * CHC Ops compatibility: mount plugins into a DomainRegistry.
 * This wrapper prevents call-site drift across diagnostics/ops tooling.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  const register: RegisterExecutorFn = registry.registerExecutor.bind(registry);
  mountCHCOpsPlugins(register as any);
}
