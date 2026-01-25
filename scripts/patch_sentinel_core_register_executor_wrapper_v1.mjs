#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const INDEX  = "packages/sentinel-core/src/index.ts";

let plugin = fs.readFileSync(PLUGIN, "utf8");

// If already present, no-op
if (/export\s+function\s+registerExecutor\s*\(/.test(plugin)) {
  console.log("OK: registerExecutor wrapper already present.");
} else {
  // We need to find an anchor that definitely exists.
  // Use the first occurrence of "export type" or "export interface" or the first "export function"
  const lines = plugin.split("\n");
  let insertAt = -1;

  // Prefer inserting after the first block of imports
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("import ")) {
      insertAt = i;
      break;
    }
  }
  if (insertAt < 0) insertAt = 0;

  const wrapper = [
    "",
    "/**",
    " * Canonical executor registration helper.",
    " * This is the single source of truth exported publicly.",
    " */",
    "export function registerExecutor(registry: { registerExecutor: (spec: any) => void }, spec: any): void {",
    "  registry.registerExecutor(spec);",
    "}",
    "",
  ].join("\n");

  lines.splice(insertAt, 0, wrapper.trimEnd());
  plugin = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  fs.writeFileSync(PLUGIN, plugin.trimEnd() + "\n");
  console.log("Patched: added registerExecutor wrapper to sentinel-core/plugin.ts");
}

// Ensure index.ts re-exports registerExecutor
let index = fs.readFileSync(INDEX, "utf8");
if (!/export\s*\{\s*registerExecutor\s*\}\s*from\s*["']\.\/plugin\.js["']/.test(index)) {
  index = index.trimEnd() + `\nexport { registerExecutor } from "./plugin.js";\n`;
  fs.writeFileSync(INDEX, index);
  console.log("Patched: re-exported registerExecutor from sentinel-core/index.ts");
} else {
  console.log("OK: index.ts already re-exports registerExecutor");
}

// Ensure RegisterExecutorFn exists
index = fs.readFileSync(INDEX, "utf8");
if (!/export\s+type\s+RegisterExecutorFn\s*=/.test(index)) {
  index =
    index.trimEnd() +
    `\n/** Canonical executor registration function type. */\nexport type RegisterExecutorFn = typeof registerExecutor;\n`;
  fs.writeFileSync(INDEX, index.trimEnd() + "\n");
  console.log("Patched: exported RegisterExecutorFn from sentinel-core/index.ts");
} else {
  console.log("OK: RegisterExecutorFn already exported from sentinel-core/index.ts");
}

run("npm test");
run("npm run build");
