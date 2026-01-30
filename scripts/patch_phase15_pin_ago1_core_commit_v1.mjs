#!/usr/bin/env node
/**
 * patch_phase15_pin_ago1_core_commit_v1.mjs
 * Phase 15A:
 * - Pin ago-1-core dependency to an immutable git SHA (no master drift)
 * - Updates package.json + package-lock.json via npm install
 *
 * Idempotent. Ends with npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }

const TARGET_SHA = process.env.AGO1_CORE_SHA || "5325ba6"; // Phase 13 commit (override if needed)

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const pkgPath = path.join(ROOT, "package.json");

if (!fs.existsSync(pkgPath)) {
  console.error("Missing:", pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(read(pkgPath));
pkg.dependencies ||= {};

const current = pkg.dependencies["ago-1-core"];
if (!current || typeof current !== "string") {
  console.error("package.json: dependencies['ago-1-core'] missing.");
  process.exit(1);
}

// Only pin github: form; if already pinned, do nothing.
const desired = `github:IMG2025/ago-1-core#${TARGET_SHA}`;

let changed = false;
if (current !== desired) {
  // If already pinned to a SHA, keep it unless different target requested.
  pkg.dependencies["ago-1-core"] = desired;
  write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Pinned ago-1-core:", current, "=>", desired);
  changed = true;
} else {
  console.log("ago-1-core already pinned:", desired);
}

// Re-resolve lockfile deterministically
console.log("== npm install (to update lockfile) ==");
run("npm install");

// Required build gate
console.log("== Running build (required) ==");
run("npm run build");

// Optional: show resolved SHA from lockfile for audit
const lockPath = path.join(ROOT, "package-lock.json");
if (fs.existsSync(lockPath)) {
  const lock = read(lockPath);
  const m = lock.match(/resolved":\\s*"git\\+ssh:\\/\\/git@github\\.com\\/IMG2025\\/ago-1-core\\.git#([0-9a-f]{7,40})/);
  if (m) console.log("Resolved ago-1-core SHA:", m[1]);
}
