#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const sentinelPkgJson = "packages/sentinel-core/package.json";
if (!fs.existsSync(sentinelPkgJson)) throw new Error(`Missing: ${sentinelPkgJson}`);

const pkg = JSON.parse(read(sentinelPkgJson));
pkg.dependencies ??= {};

const dep = "@chc/nexus-core";

// Termux npm may not support "workspace:*". Use "*" instead; workspaces will still link locally.
const desired = "*";

if (pkg.dependencies[dep] !== desired) {
  pkg.dependencies[dep] = desired;
  writeIfChanged(sentinelPkgJson, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`OK: set ${dep} => ${desired} (avoid unsupported workspace: protocol).`);
} else {
  console.log(`OK: ${dep} already pinned to ${desired}.`);
}

// Install so TS can resolve workspace types through node_modules
run("npm install");

// Prove compile path and gates are green
run("npm -w @chc/nexus-core run build");
run("npm -w @chc/sentinel-core run build");

// Re-run Step 8 lock script (should now compile)
run("node scripts/patch_step_8_lock_policy_execution_binding_v1.mjs");
run("node scripts/patch_step_8_lock_policy_execution_binding_v1.mjs");

run("npm test");
run("npm run build");
