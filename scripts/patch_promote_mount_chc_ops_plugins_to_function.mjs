#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const file = "src/plugin.ts";
if (!fs.existsSync(file)) throw new Error("src/plugin.ts not found");

let src = fs.readFileSync(file, "utf8");

// If canonical function already exists and no const export remains, we are done.
if (/export function mountCHCOpsPlugins\s*\(/.test(src) &&
    !/export const mountCHCOpsPlugins\s*=/.test(src)) {
  console.log("OK: mountCHCOpsPlugins already canonical (no-op).");
  run("npm run build");
  process.exit(0);
}

// Find const export target: export const mountCHCOpsPlugins = SOME_NAME;
const m = src.match(/export const mountCHCOpsPlugins\s*=\s*([A-Za-z0-9_]+)\s*;\s*/);
if (!m) {
  throw new Error("Expected 'export const mountCHCOpsPlugins = <name>;' not found");
}
const targetFn = m[1];

// Remove the const export line (idempotent)
src = src.replace(/export const mountCHCOpsPlugins\s*=\s*[A-Za-z0-9_]+\s*;\s*/g, "");

// Ensure we have required types in this file.
// We will add imports only if missing.
function ensureImportType(symbol, fromPath) {
  const re = new RegExp(`import\\s+type\\s+\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s+from\\s+["']${fromPath}["']\\s*;`);
  if (re.test(src)) return;
  // If there is any import from same path, extend it is complex; instead append a clean import.
  src = `import type { ${symbol} } from "${fromPath}";\n` + src;
}
function ensureImport(symbol, fromPath) {
  const re = new RegExp(`import\\s+\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s+from\\s+["']${fromPath}["']\\s*;`);
  if (re.test(src)) return;
  src = `import { ${symbol} } from "${fromPath}";\n` + src;
}

// DomainRegistry + RegisterExecutorFn live in contracts (in this repo’s pattern)
ensureImportType("RegisterExecutorFn", "./contracts/plugin.js");
ensureImportType("DomainRegistry", "./registry.js"); // DomainRegistry class is exported from registry
// Note: if DomainRegistry is actually exported from index/contracts in your tree, we’ll catch it on build and adjust with another patch.

const fnBlock = `
/**
 * CHC Ops compatibility mount.
 * Canonical entrypoint for ops tooling and diagnostics.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  const register: RegisterExecutorFn = registry.registerExecutor.bind(registry) as any;
  ${targetFn}(register);
}
`;

// If function already exists (but const was also present), do not add another.
if (!/export function mountCHCOpsPlugins\s*\(/.test(src)) {
  src = src.trimEnd() + "\n" + fnBlock.trimStart();
}

fs.writeFileSync(file, src.trimEnd() + "\n");

console.log(`Patched: promoted mountCHCOpsPlugins const -> function (calls ${targetFn}).`);
run("npm run build");
