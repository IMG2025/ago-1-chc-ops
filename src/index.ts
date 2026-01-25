import { DomainRegistry } from "./registry";
import { registerHospitality } from "hospitality-ago-1";
import { registerCIAG } from "ciag-ago-1";

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
  registerHospitality({ registerExecutor: (spec) => registry.registerExecutor(spec) });
  registerCIAG({ registerExecutor: (spec) => registry.registerExecutor(spec) });
}

export { registerHospitality, registerCIAG };
