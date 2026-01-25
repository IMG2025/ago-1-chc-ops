import { hospitalityExecutorSpec, ciagExecutorSpec } from "./executors.js";
import { DomainRegistry } from "./registry";
export { registerHospitality } from "hospitality-ago-1";
export { registerCIAG } from "ciag-ago-1";
/**
 * Minimal registry surface needed by domain plugins.
 * We keep this intentionally small to avoid coupling CHC Ops to core internals.
 */
export type ExecutorRegistryLike = {
  registerExecutor: (spec: unknown) => void;
};

/**
 * CHC Ops plugin mount: registers all enabled domain plugins into the provided registry.
 * No globals. No side effects. Deterministic.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  registry.registerExecutor(hospitalityExecutorSpec);
registry.registerExecutor(ciagExecutorSpec);
}

export * from "./contracts/index.js";

export * from "./authorize.js";
