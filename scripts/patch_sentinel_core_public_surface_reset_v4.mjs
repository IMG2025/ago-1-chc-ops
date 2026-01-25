#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const REG = "packages/sentinel-core/src/registry.ts";
const ERR = "packages/sentinel-core/src/errors.ts";
const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const INDEX = "packages/sentinel-core/src/index.ts";

for (const f of [REG, PLUGIN, INDEX]) {
  if (!fs.existsSync(f)) throw new Error(`Missing: ${f}`);
}
if (!fs.existsSync(ERR)) throw new Error(`Missing: ${ERR} (needed to derive TaskType via getTaskType)`);

// 1) plugin.ts: canonical exports
const pluginOut =
`import type { ExecutorRegistry, ExecutorSpec } from "./registry.js";
import { hospitalityExecutorSpec } from "./executors.js";

/**
 * Canonical executor registration API for CHC Ops.
 */
export function registerExecutor(registry: ExecutorRegistry, spec: ExecutorSpec): void {
  registry.registerExecutor(spec);
}

/**
 * Back-compat mount entrypoint used by CHC Ops.
 */
export function mountCHCOpsPlugins(registry: ExecutorRegistry): void {
  registerExecutor(registry, hospitalityExecutorSpec);
}

/**
 * Canonical type for the executor registration function.
 */
export type RegisterExecutorFn = typeof registerExecutor;
`;

fs.writeFileSync(PLUGIN, pluginOut);

// 2) index.ts: canonical exports (no export* collisions)
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

console.log("OK: sentinel-core public surface reset v4 ensured.");

// Gates: sentinel-core then root
run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
