#!/usr/bin/env node
/**
 * patch_phase15_pin_ago1_core_commit_v1_1.mjs
 * FIX: remove invalid regex literal; use safe string scan
 *
 * Idempotent. Ends with npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }

const TARGET_SHA = process.env.AGO1_CORE_SHA || "5325ba6";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const pkgPath = path.join(ROOT, "package.json");

if (!fs.existsSync(pkgPath)) {
  console.error("Missing:", pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(read(pkgPath));
pkg.dependencies ||= {};

const desired = `github:IMG2025/ago-1-core#${TARGET_SHA}`;
const current = pkg.dependencies["ago-1-core"];

if (current !== desired) {
  pkg.dependencies["ago-1-core"] = desired;
  write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Pinned ago-1-core:", current, "=>", desired);
} else {
  console.log("ago-1-core already pinned:", desired);
}

console.log("== npm install (lockfile sync) ==");
run("npm install");

console.log("== Running build (required) ==");
run("npm run build");

/* ---- Optional audit (non-fatal) ---- */
const lockPath = path.join(ROOT, "package-lock.json");
if (fs.existsSync(lockPath)) {
  const lock = read(lockPath);
  const needle = "IMG2025/ago-1-core.git#";
  const idx = lock.indexOf(needle);
  if (idx !== -1) {
    const sha = lock.slice(idx + needle.length, idx + needle.length + 40);
    console.log("Resolved ago-1-core SHA (lockfile):", sha);
  }
}
