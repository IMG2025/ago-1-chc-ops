#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const INDEX  = "packages/sentinel-core/src/index.ts";

let plugin = fs.readFileSync(PLUGIN, "utf8");

// 1) Ensure registerExecutor exists
if (!/registerExecutor/.test(plugin)) {
  throw new Error("Invariant violated: registerExecutor not found in sentinel-core plugin.ts");
}

// 2) Ensure registerExecutor is exported (function or const)
if (!/export\s+(function|const)\s+registerExecutor\b/.test(plugin)) {
  // export function registerExecutor
  if (/function\s+registerExecutor\b/.test(plugin)) {
    plugin = plugin.replace(/(^|\n)(\s*)function\s+registerExecutor\b/, "$1$2export function registerExecutor");
  } else if (/\bconst\s+registerExecutor\b/.test(plugin)) {
    plugin = plugin.replace(/(^|\n)(\s*)const\s+registerExecutor\b/, "$1$2export const registerExecutor");
  } else {
    throw new Error("Invariant violated: registerExecutor found but not as function/const declaration");
  }
  fs.writeFileSync(PLUGIN, plugin);
  console.log("Patched: exported registerExecutor from sentinel-core/plugin.ts");
} else {
  console.log("OK: registerExecutor already exported from plugin.ts");
}

let index = fs.readFileSync(INDEX, "utf8");

// 3) Ensure index.ts re-exports registerExecutor
if (!/export\s*\{\s*registerExecutor\s*\}\s*from\s*["']\.\/plugin\.js["']/.test(index)) {
  index = index.trimEnd() + `\nexport { registerExecutor } from "./plugin.js";\n`;
  fs.writeFileSync(INDEX, index);
  console.log("Patched: re-exported registerExecutor from sentinel-core/index.ts");
} else {
  console.log("OK: index.ts already re-exports registerExecutor");
}

// 4) Ensure RegisterExecutorFn type is exported from index.ts
index = fs.readFileSync(INDEX, "utf8");
if (!/export\s+type\s+RegisterExecutorFn\s*=/.test(index)) {
  index =
    index.trimEnd() +
    `\n/** Canonical executor registration function type. */\nexport type RegisterExecutorFn = typeof registerExecutor;\n`;
  fs.writeFileSync(INDEX, index + "\n");
  console.log("Patched: exported RegisterExecutorFn from sentinel-core/index.ts");
} else {
  console.log("OK: RegisterExecutorFn already exported from index.ts");
}

run("npm test");
run("npm run build");
