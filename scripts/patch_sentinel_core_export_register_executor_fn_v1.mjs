#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const PLUGIN = path.join(ROOT, "packages/sentinel-core/src/plugin.ts");
const INDEX = path.join(ROOT, "packages/sentinel-core/src/index.ts");

if (!fs.existsSync(PLUGIN)) throw new Error(`Missing file: ${PLUGIN}`);
if (!fs.existsSync(INDEX)) throw new Error(`Missing file: ${INDEX}`);

let pluginSrc = fs.readFileSync(PLUGIN, "utf8");
let indexSrc = fs.readFileSync(INDEX, "utf8");

// 1) Ensure plugin.ts exports type RegisterExecutorFn derived from the real function
const TYPE_LINE = `export type RegisterExecutorFn = typeof registerExecutor;`;
if (!pluginSrc.includes(TYPE_LINE)) {
  // Hard requirement: registerExecutor must exist as an exported function
  if (!/export\s+function\s+registerExecutor\s*\(/.test(pluginSrc)) {
    throw new Error("Invariant violated: expected 'export function registerExecutor(' in sentinel-core/src/plugin.ts");
  }

  // Append type alias at EOF (safe + idempotent)
  pluginSrc = pluginSrc.trimEnd() + `\n\n/**\n * Canonical type for the exported registerExecutor API.\n * Derived from the function to avoid signature drift.\n */\n${TYPE_LINE}\n`;
  fs.writeFileSync(PLUGIN, pluginSrc);
}

// 2) Ensure index.ts re-exports the type
const REEXPORT_LINE = `export type { RegisterExecutorFn } from "./plugin.js";`;
if (!indexSrc.includes(REEXPORT_LINE)) {
  indexSrc = indexSrc.trimEnd() + `\n${REEXPORT_LINE}\n`;
  fs.writeFileSync(INDEX, indexSrc);
}

console.log("OK: sentinel-core now exports RegisterExecutorFn publicly (type + barrel).");
run("npm run build");
