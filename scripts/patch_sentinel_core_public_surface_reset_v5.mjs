#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const REG = "packages/sentinel-core/src/registry.ts";
const ERR = "packages/sentinel-core/src/errors.ts";
const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const INDEX = "packages/sentinel-core/src/index.ts";

for (const f of [REG, PLUGIN, INDEX, ERR]) {
  if (!fs.existsSync(f)) throw new Error(`Missing: ${f}`);
}

/**
 * v5 rule: RegisterExecutorFn is a 1-arg registrar callback: (spec) => void
 * This matches how CHC Ops plugins are authored (register(hospitalityExecutorSpec)).
 * We still expose a 2-arg helper registerExecutor(registry, spec) for convenience.
 */

// 1) plugin.ts
const pluginOut =
`import type { ExecutorRegistry, ExecutorSpec } from "./registry.js";
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
 * Back-compat mount function (used by diagnostics / quick smoke).
 * Accepts a registrar callback to keep the surface 1-arg and stable.
 */
export function mountCHCOpsPlugins(register: RegisterExecutorFn): void {
  register(hospitalityExecutorSpec);
}
`;
fs.writeFileSync(PLUGIN, pluginOut);

// 2) index.ts — avoid export* collisions; export only the stable surface
const indexOut =
`// Canonical sentinel-core public surface (single source of truth).

export type { ExecutorSpec, ExecutorRegistry } from "./registry.js";
export { DomainRegistry, createRegistry } from "./registry.js";

export { registerExecutor, mountCHCOpsPlugins } from "./plugin.js";
export type { RegisterExecutorFn } from "./plugin.js";

import { getTaskType } from "./errors.js";
export type TaskType = ReturnType<typeof getTaskType>;
export { chcOpsError, getTaskType } from "./errors.js";
`;
fs.writeFileSync(INDEX, indexOut);

console.log("OK: sentinel-core public surface reset v5 ensured (RegisterExecutorFn is 1-arg registrar).");

// Gates: sentinel-core then root
run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
