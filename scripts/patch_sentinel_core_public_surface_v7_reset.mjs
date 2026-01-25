#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const INDEX  = "packages/sentinel-core/src/index.ts";
const DIAG   = "packages/sentinel-core/src/diagnostics/listDomains.ts";
const REG    = "packages/sentinel-core/src/registry.ts";
const ERR    = "packages/sentinel-core/src/errors.ts";
const EXEC   = "packages/sentinel-core/src/executors.ts";

for (const f of [PLUGIN, INDEX, DIAG, REG, ERR, EXEC]) {
  if (!fs.existsSync(f)) throw new Error(`Missing required file: ${f}`);
}

// ---------- plugin.ts (canonical) ----------
const pluginOut = `import type { ExecutorRegistry, ExecutorSpec } from "./registry.js";
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
 * Back-compat mount entrypoint.
 * Supports two calling styles:
 *  - mountCHCOpsPlugins(registerFn)
 *  - mountCHCOpsPlugins(registryWithRegisterExecutor)
 */
export function mountCHCOpsPlugins(register: RegisterExecutorFn): void;
export function mountCHCOpsPlugins(registry: ExecutorRegistry): void;
export function mountCHCOpsPlugins(arg: RegisterExecutorFn | ExecutorRegistry): void {
  const register: RegisterExecutorFn =
    typeof arg === "function"
      ? arg
      : (spec: ExecutorSpec) => arg.registerExecutor(spec);

  register(hospitalityExecutorSpec);
}
`;

fs.writeFileSync(PLUGIN, pluginOut);

// ---------- index.ts (canonical barrel; NO export* collisions) ----------
const indexOut = `// Canonical sentinel-core public surface (single source of truth).

export type { ExecutorSpec, ExecutorRegistry } from "./registry.js";
export { DomainRegistry, createRegistry } from "./registry.js";

export { registerExecutor, mountCHCOpsPlugins } from "./plugin.js";
export type { RegisterExecutorFn } from "./plugin.js";

import { getTaskType } from "./errors.js";
export type TaskType = ReturnType<typeof getTaskType>;
export { chcOpsError, getTaskType } from "./errors.js";
`;

fs.writeFileSync(INDEX, indexOut);

// ---------- diagnostics/listDomains.ts canonical call ----------
let diag = fs.readFileSync(DIAG, "utf8");

// Ensure it imports correctly
if (!/mountCHCOpsPlugins/.test(diag)) {
  // If file is unexpectedly different, we will not guess; just keep it unchanged.
} else {
  // Canonicalize call: pass registrar fn using registry.registerExecutor
  // Works regardless of overloads and avoids future signature drift.
  diag = diag.replace(
    /mountCHCOpsPlugins\s*\(\s*registry\s*\)\s*;/g,
    "mountCHCOpsPlugins((spec) => registry.registerExecutor(spec));"
  );
  fs.writeFileSync(DIAG, diag);
}

console.log("OK: sentinel-core public surface v7 reset applied (plugin/index/diagnostics aligned).");

// Gates
run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
