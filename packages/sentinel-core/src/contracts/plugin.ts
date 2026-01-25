import type { RegisterExecutorFn } from "./registry.js";

/**
 * Single, canonical plugin registration contract.
 * Every domain plugin must expose a register function that conforms to this shape.
 */
export type RegisterPluginFn = (register: RegisterExecutorFn) => void;
