// Canonical sentinel-core public surface (single source of truth).

export type { ExecutorSpec, ExecutorRegistry } from "./registry.js";
export { DomainRegistry, createRegistry } from "./registry.js";

export { registerExecutor, mountCHCOpsPlugins } from "./plugin.js";
export type { RegisterExecutorFn } from "./plugin.js";

import { getTaskType } from "./errors.js";
export type TaskType = ReturnType<typeof getTaskType>;
export { chcOpsError, getTaskType } from "./errors.js";
