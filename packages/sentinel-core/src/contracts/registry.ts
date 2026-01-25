import type { ExecutorSpec } from "./executor.js";

/**
 * Minimal registry contract CHC Ops depends on.
 * Domain registries may implement additional methods, but must satisfy this.
 */
export type RegisterExecutorFn = (spec: ExecutorSpec) => void;
