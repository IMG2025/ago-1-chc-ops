#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}
function write(file, content) {
  fs.writeFileSync(file, content.trimEnd() + "\n");
}

function ensureDepWorkspaceStar(pkgPath, depName) {
  const pkg = JSON.parse(read(pkgPath));
  pkg.dependencies ||= {};
  if (!pkg.dependencies[depName]) {
    pkg.dependencies[depName] = "workspace:*";
    write(pkgPath, JSON.stringify(pkg, null, 2));
    console.log(`Patched: added dependency ${depName}@workspace:*`);
    return true;
  }
  console.log(`OK: dependency ${depName} already present.`);
  return false;
}

function ensureShim(file, content) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
  const src = read(file);
  if (src.includes("CHC_OPS_SENTINEL_CORE_REEXPORT_SHIM")) {
    console.log(`OK: ${file} already shimmed.`);
    return false;
  }
  write(file, content);
  console.log(`Patched: shimmed ${file}`);
  return true;
}

// 0) Ensure dependency exists at root (workspace package)
ensureDepWorkspaceStar("package.json", "@chc/sentinel-core");

// 1) Convert CHC ops contracts into re-export shims (minimal blast radius)
ensureShim(
  "src/contracts/executor.ts",
  `/**
 * CHC_OPS_SENTINEL_CORE_REEXPORT_SHIM
 * Canonical contract types live in @chc/sentinel-core.
 */
export type { ExecutorSpec, TaskType } from "@chc/sentinel-core";
export type { RegisterExecutorFn } from "@chc/sentinel-core";
`
);

ensureShim(
  "src/contracts/index.ts",
  `/**
 * CHC_OPS_SENTINEL_CORE_REEXPORT_SHIM
 * Canonical contract types live in @chc/sentinel-core.
 */
export type { ExecutorSpec, TaskType, RegisterExecutorFn } from "@chc/sentinel-core";
`
);

// 2) Optional: if these files exist, shim them too (safe + idempotent)
const optional = [
  "src/contracts/plugin.ts",
  "src/contracts/registry.ts",
];
for (const f of optional) {
  if (fs.existsSync(f)) {
    ensureShim(
      f,
      `/**
 * CHC_OPS_SENTINEL_CORE_REEXPORT_SHIM
 * Canonical contract types live in @chc/sentinel-core.
 */
export * from "@chc/sentinel-core";
`
    );
  }
}

// 3) Gates
run("npm test");
run("npm run build");
