import { hospitalityExecutorSpec } from "./executors.js";
import type { PluginRegistrar } from "./contracts/plugin.js";
export function registerHospitality(reg: PluginRegistrar<import("./contracts/executor.js").ExecutorSpec>): void {
  reg.registerExecutor(hospitalityExecutorSpec);
}
