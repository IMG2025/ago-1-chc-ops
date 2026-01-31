#!/usr/bin/env node
/**
 * Phase 21C hygiene — remove duplicate "lock archive" script from archive folder.
 * Canonical source of truth stays in: scripts/patch_phase21c_lock_archive_and_smokes_v1.mjs
 *
 * Idempotent. Required gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const archiveDup = path.join("scripts","_archive","phase21c","patch_phase21c_lock_archive_and_smokes_v1.mjs");
const canonical = path.join("scripts","patch_phase21c_lock_archive_and_smokes_v1.mjs");

if (!exists(canonical)) {
  console.error("Missing canonical script:", canonical);
  process.exit(1);
}

if (exists(archiveDup)) {
  fs.unlinkSync(archiveDup);
  console.log("Removed duplicate archived script:", archiveDup);
} else {
  console.log("No duplicate archived script found (already clean).");
}

console.log("== Syntax check (required gate) ==");
run("node --check " + canonical);

console.log("== Running build (required) ==");
run("npm run build");
