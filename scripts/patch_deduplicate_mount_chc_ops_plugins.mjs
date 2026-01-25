#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const file = "src/plugin.ts";
if (!fs.existsSync(file)) throw new Error("src/plugin.ts not found");

let src = fs.readFileSync(file, "utf8");

// Guard: if already canonical, no-op
if (/export function mountCHCOpsPlugins\s*\(/.test(src) &&
    !/export const mountCHCOpsPlugins\s*=/.test(src)) {
  console.log("OK: mountCHCOpsPlugins already canonical (no-op).");
  run("npm run build");
  process.exit(0);
}

// Remove const export if present
src = src.replace(
  /export const mountCHCOpsPlugins\s*=\s*[a-zA-Z0-9_]+;\s*/g,
  ""
);

// Ensure exactly one exported function
if (!/export function mountCHCOpsPlugins\s*\(/.test(src)) {
  throw new Error("Canonical mountCHCOpsPlugins function not found");
}

fs.writeFileSync(file, src.trimEnd() + "\n");

console.log("Patched: deduplicated mountCHCOpsPlugins export.");
run("npm run build");
