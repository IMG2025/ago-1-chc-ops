#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const PKG = path.join("packages", "sentinel-core");
const SRC = path.join(PKG, "src");
const CONTRACTS = path.join(SRC, "contracts");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(file, content) {
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, content.trimEnd() + "\n");
  return true;
}

function replaceAll(file, fn) {
  const before = fs.readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) fs.writeFileSync(file, after);
  return after !== before;
}

if (!fs.existsSync(PKG)) {
  throw new Error("sentinel-core package missing; run v3 workspace scaffolder first.");
}

ensureDir(CONTRACTS);

// 1) Contracts: executor.ts + index.ts (minimal, stable)
writeIfMissing(
  path.join(CONTRACTS, "executor.ts"),
  `
export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;
  supported_task_types: readonly TaskType[];
  required_scopes: Readonly<Partial<Record<TaskType, readonly string[]>>>;
  domain_action_scopes?: readonly string[];
  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;
`
);

writeIfMissing(
  path.join(CONTRACTS, "index.ts"),
  `
export type { ExecutorSpec, TaskType } from "./executor.js";
export type RegisterExecutorFn = (spec: ExecutorSpec) => void;
`
);

// 2) plugin.ts: canonical register function + compatibility alias
const pluginFile = path.join(SRC, "plugin.ts");
if (!fs.existsSync(pluginFile)) throw new Error("packages/sentinel-core/src/plugin.ts missing");

replaceAll(pluginFile, (src) => {
  // ensure import of RegisterExecutorFn from contracts index
  if (!src.includes('from "./contracts/index.js"')) {
    // insert after first import line (or at top if none)
    if (/^import\s/m.test(src)) {
      src = src.replace(/^(import[^\n]*\n)/m, `$1import type { RegisterExecutorFn } from "./contracts/index.js";\n`);
    } else {
      src = `import type { RegisterExecutorFn } from "./contracts/index.js";\n` + src;
    }
  }

  // if registerSentinelCore exists, keep as-is (idempotent)
  if (/export\s+function\s+registerSentinelCore\s*\(/.test(src)) return src;

  // if we have registerHospitality, wrap it
  if (/export\s+function\s+registerHospitality\s*\(/.test(src)) {
    // add canonical function that delegates to registerHospitality
    return src.trimEnd() + `
/**
 * Canonical sentinel-core plugin registration.
 * Kept stable for workspace consumers.
 */
export function registerSentinelCore(register: RegisterExecutorFn): void {
  registerHospitality(register);
}
`.trimEnd() + "\n";
  }

  // otherwise add a minimal placeholder canonical function
  return src.trimEnd() + `
/**
 * Canonical sentinel-core plugin registration.
 * Currently minimal; expanded as sentinel-core grows.
 */
export function registerSentinelCore(_register: RegisterExecutorFn): void {
  // no-op
}
`.trimEnd() + "\n";
});

// 3) index.ts: export contracts + plugin
const indexFile = path.join(SRC, "index.ts");
writeIfMissing(
  indexFile,
  `
export * from "./contracts/index.js";
export * from "./plugin.js";
`
);

replaceAll(indexFile, (src) => {
  // ensure both exports exist, without duplicates
  const lines = src.split("\n").filter(Boolean);
  const wanted = [
    'export * from "./contracts/index.js";',
    'export * from "./plugin.js";',
  ];
  const set = new Set(lines);
  for (const w of wanted) set.add(w);
  return Array.from(set).join("\n") + "\n";
});

console.log("OK: sentinel-core public surface v1 ensured.");

run("npm run build");
run("npm test");
