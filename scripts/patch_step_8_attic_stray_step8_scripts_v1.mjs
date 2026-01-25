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
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPTS = "scripts";
const ATTIC = path.join(SCRIPTS, "_attic", "step-8");
ensureDir(ATTIC);

// Keep list must match enforcer policy
const KEEP = new Set([
  "patch_step_8_lock_policy_execution_binding_v1.mjs",
  "patch_step_8_termux_bridge_handshake_types_v1.mjs",
  "patch_step_8_enforce_canonical_surface_v1.mjs",
  "patch_step_8_create_enforcer_canonical_surface_v1.mjs",
]);

// This is the offender reported by the enforcer
const offender = "patch_step_8_attic_enforce_utility_v1.mjs";

function moveToAttic(name) {
  const src = path.join(SCRIPTS, name);
  if (!exists(src)) return false;
  if (KEEP.has(name)) return false;

  const dst = path.join(ATTIC, name);
  if (!exists(dst)) {
    fs.renameSync(src, dst);
  } else {
    fs.rmSync(src, { force: true });
  }
  return true;
}

let moved = 0;
if (moveToAttic(offender)) moved += 1;

// Update attic README with a small inventory note (idempotent)
const readme = path.join(ATTIC, "README.md");
const base = `# Step 8 Attic

This directory contains non-canonical Step 8 recovery / utility scripts retained for traceability.

## Canonical Step 8 scripts (kept in /scripts)
- patch_step_8_lock_policy_execution_binding_v1.mjs
- patch_step_8_termux_bridge_handshake_types_v1.mjs
- patch_step_8_enforce_canonical_surface_v1.mjs
- patch_step_8_create_enforcer_canonical_surface_v1.mjs

`;
let next = base;
if (exists(readme)) {
  const prev = readme ? read(readme) : "";
  // If prior README has extra content, keep it by appending after base once.
  if (prev && !prev.startsWith(base)) next = base + "\n" + prev;
}
writeIfChanged(readme, next);

console.log(`OK: Step 8 attic sweep complete. Moved ${moved} file(s) to ${ATTIC}.`);

// Prove enforcement + gates (idempotency proof)
run("node scripts/patch_step_8_enforce_canonical_surface_v1.mjs");
run("node scripts/patch_step_8_enforce_canonical_surface_v1.mjs");
run("./scripts/gate_ci_termux_v1.sh");
run("./scripts/gate_ci_termux_v1.sh");

// Must end with npm run build
run("npm test");
run("npm run build");
