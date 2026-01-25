import type { ExecutorRegistry, ExecutorSpec } from "./registry.js";
import { hospitalityExecutorSpec } from "./executors.js";

/**
 * Canonical CHC plugin registrar callback.
 * Plugins call this with a spec: register(spec).
 */
export type RegisterExecutorFn = (spec: ExecutorSpec) => void;

/**
 * Helper: register a spec into a concrete registry.
 */
export function registerExecutor(registry: ExecutorRegistry, spec: ExecutorSpec): void {
  registry.registerExecutor(spec);
}

/**
 * Back-compat mount entrypoint.
 * Supports two calling styles:
 *  - mountCHCOpsPlugins(registerFn)
 *  - mountCHCOpsPlugins(registryWithRegisterExecutor)
 */
export function mountCHCOpsPlugins(register: RegisterExecutorFn): void;
export function mountCHCOpsPlugins(registry: ExecutorRegistry): void;
export function mountCHCOpsPlugins(arg: RegisterExecutorFn | ExecutorRegistry): void {
  const register: RegisterExecutorFn =
    typeof arg === "function"
      ? arg
      : (spec: ExecutorSpec) => arg.registerExecutor(spec);

  register(hospitalityExecutorSpec);
}
