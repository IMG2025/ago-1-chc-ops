#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const IDX = "packages/sentinel-core/src/index.ts";
const PLUGIN = "packages/sentinel-core/src/plugin.ts";

if (!fs.existsSync(IDX)) throw new Error(`Missing: ${IDX}`);
if (!fs.existsSync(PLUGIN)) throw new Error(`Missing: ${PLUGIN}`);

let idx = fs.readFileSync(IDX, "utf8");
let plugin = fs.readFileSync(PLUGIN, "utf8");

// ---------- A) index.ts: remove problematic exports + dedupe ----------
idx = idx
  // Remove the ambiguous export * from contracts barrel (this caused TS2308 collisions)
  .replace(/^\s*export\s+\*\s+from\s+["']\.\/contracts\/index\.js["'];\s*$/gm, "")
  // Remove any re-export lines that conflict with our canonical local pattern
  .replace(/^\s*export\s*\{\s*registerExecutor\s*\}\s*from\s*["']\.\/plugin\.js["'];\s*$/gm, "")
  .replace(/^\s*export\s+type\s*\{\s*RegisterExecutorFn\s*\}\s*from\s*["']\.\/plugin\.js["'];\s*$/gm, "")
  // Remove any existing local "export { registerExecutor };" so we can re-add exactly once
  .replace(/^\s*export\s*\{\s*registerExecutor\s*\}\s*;\s*$/gm, "")
  // Remove any existing RegisterExecutorFn type alias so we can re-add exactly once
  .replace(/^\s*export\s+type\s+RegisterExecutorFn\s*=\s*[^;]+;\s*$/gm, "");

// Ensure single local import of registerExecutor
const importLine = `import { registerExecutor } from "./plugin.js";`;
if (!idx.includes(importLine)) {
  idx = importLine + "\n" + idx.trimStart();
} else {
  // Deduplicate if present multiple times
  idx = idx.replace(new RegExp(`${importLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n`, "g"), "");
  idx = importLine + "\n" + idx.trimStart();
}

// Append canonical exports at EOF (idempotent)
idx = idx.trimEnd() + "\n\n";
idx += `export { registerExecutor };\n`;
idx += `/**\n * Canonical public executor registration function type.\n * Derived from registerExecutor to prevent drift.\n */\n`;
idx += `export type RegisterExecutorFn = typeof registerExecutor;\n`;

fs.writeFileSync(IDX, idx);

// ---------- B) plugin.ts: remove any RegisterExecutorFn type alias and conflicting imports ----------
plugin = plugin
  // Remove any imported RegisterExecutorFn (these conflicted with local declarations)
  .replace(/^\s*import\s+type\s*\{\s*RegisterExecutorFn\s*\}\s+from\s+["'][^"']+["'];\s*$/gm, "")
  // Remove any exported RegisterExecutorFn type alias appended previously
  .replace(/^\s*\/\*\*[\s\S]*?\*\/\s*export\s+type\s+RegisterExecutorFn\s*=\s*typeof\s+registerExecutor\s*;\s*$/gm, "")
  .replace(/^\s*export\s+type\s+RegisterExecutorFn\s*=\s*typeof\s+registerExecutor\s*;\s*$/gm, "");

fs.writeFileSync(PLUGIN, plugin.trimEnd() + "\n");

console.log("OK: sentinel-core barrel canonicalized (no contracts star export; executor exports deduped).");

// Gates
run("npm -w @chc/sentinel-core run build");
run("npm run build");
