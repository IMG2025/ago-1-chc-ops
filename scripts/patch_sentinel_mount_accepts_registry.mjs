#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const pluginPath = path.join(ROOT, "packages", "sentinel-core", "src", "plugin.ts");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

if (!fs.existsSync(pluginPath)) throw new Error(`Missing: ${pluginPath}`);

let src = fs.readFileSync(pluginPath, "utf8");

// No-op if already patched
if (/mountCHCOpsPlugins\s*\(\s*registry\s*:\s*DomainRegistry\s*\)/.test(src)) {
  console.log("OK: sentinel-core mount already accepts DomainRegistry (no-op).");
  run("npm -w @chc/sentinel-core run build");
  run("npm run build");
  process.exit(0);
}

// We need to find the existing mount function name in plugin.ts.
// Prefer an explicitly exported function/const that begins with "mount".
let canonical =
  (src.match(/export\s+function\s+(mount[A-Za-z0-9_]+)\s*\(/) ?? [])[1] ??
  (src.match(/export\s+const\s+(mount[A-Za-z0-9_]+)\s*=/) ?? [])[1];

if (!canonical) {
  // Fall back: first exported function/const in file (least ideal, but deterministic)
  canonical =
    (src.match(/export\s+function\s+([A-Za-z0-9_]+)\s*\(/) ?? [])[1] ??
    (src.match(/export\s+const\s+([A-Za-z0-9_]+)\s*=/) ?? [])[1];
}

if (!canonical) {
  throw new Error("Could not infer canonical exported mount symbol from sentinel-core plugin.ts");
}

// Ensure required imports exist (DomainRegistry + RegisterExecutorFn)
const needsDomainRegistryImport = !/DomainRegistry/.test(src);
const needsRegisterFnImport = !/RegisterExecutorFn/.test(src);

function ensureImport(spec) {
  if (src.includes(spec)) return;
  src = spec + "\n" + src;
}

// These paths assume sentinel-core mirrors the same contracts layout it previously copied.
// If they differ, the build will tell us, and we’ll adjust by script.
if (needsDomainRegistryImport) {
  ensureImport(`import type { DomainRegistry } from "./registry.js";`);
}
if (needsRegisterFnImport) {
  ensureImport(`import type { RegisterExecutorFn } from "./contracts/plugin.js";`);
}

// Inject wrapper at end of file
src = src.trimEnd() + `

/**
 * CHC Ops compatibility: mount plugins into a DomainRegistry.
 * This wrapper prevents call-site drift across diagnostics/ops tooling.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  const register: RegisterExecutorFn = registry.registerExecutor.bind(registry);
  ${canonical}(register as any);
}
`;

fs.writeFileSync(pluginPath, src);
console.log(`Patched: mountCHCOpsPlugins(registry: DomainRegistry) wrapper added -> ${canonical}`);

run("npm -w @chc/sentinel-core run build");
run("npm run build");
