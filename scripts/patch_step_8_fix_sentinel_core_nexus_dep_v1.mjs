#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
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
const desired = "workspace:*";

if (pkg.dependencies[dep] !== desired) {
  pkg.dependencies[dep] = desired;
  writeIfChanged(sentinelPkgJson, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`OK: set ${dep} => ${desired} in sentinel-core dependencies.`);
} else {
  console.log(`OK: ${dep} already pinned to ${desired} in sentinel-core dependencies.`);
}

// Install so workspace link exists in node_modules for TS resolution
run("npm install");

// Prove compile path and gates are green
run("npm -w @chc/nexus-core run build");
run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
