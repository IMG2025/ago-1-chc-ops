import { hospitalityExecutorSpec, ciagExecutorSpec, chcExecutorSpec } from "./executors.js";
import { DomainRegistry } from "./registry";
// export { registerCIAG } from "ciag-ago-1";  // TODO: Re-enable when ciag-ago-1 is published
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
registry.registerExecutor(ciagExecutorSpec); registry.registerExecutor(chcExecutorSpec);
}

export * from "./contracts/index.js";

export * from "./authorize.js";
/* NOTE: hospitality-ago-1 export intentionally decoupled */
// CHC Ops must not hard-depend on other AGO-1 repos. Use MCP tool plane via Nexus instead.
export { mcp } from "ago-1-core";
