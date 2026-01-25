import type { RegisterExecutorFn } from "./contracts/registry.js";
import { hospitalityExecutorSpec } from "./executors.js";
export function registerHospitality(register: RegisterExecutorFn): void {
  register(hospitalityExecutorSpec);
}
