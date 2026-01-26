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

const STRAYS = [
  "patch_step_8_allow_attic_sweep_utility_v1.mjs",
  "patch_step_8_attic_stray_step8_scripts_v1.mjs",
];

function moveToAttic(name) {
  const src = path.join(SCRIPTS, name);
  if (!exists(src)) return false;
  const dst = path.join(ATTIC, name);
  if (!exists(dst)) {
    fs.renameSync(src, dst);
  } else {
    fs.rmSync(src, { force: true });
  }
  return true;
}

let moved = 0;
for (const s of STRAYS) if (moveToAttic(s)) moved++;

console.log(`OK: moved ${moved} stray Step-8 utility script(s) to ${ATTIC}.`);

// Remove stray allowlist entry from the enforcer (idempotent)
const ENFORCER = path.join(SCRIPTS, "patch_step_8_enforce_canonical_surface_v1.mjs");
if (!exists(ENFORCER)) throw new Error(`Missing: ${ENFORCER}`);

let enforcerSrc = read(ENFORCER);

// We previously injected: , "patch_step_8_attic_stray_step8_scripts_v1.mjs"
enforcerSrc = enforcerSrc.replace(
  /,\s*"patch_step_8_attic_stray_step8_scripts_v1\.mjs"\s*/g,
  ""
);

writeIfChanged(ENFORCER, enforcerSrc);

// Keep attic README present (idempotent)
const readme = path.join(ATTIC, "README.md");
const base = `# Step 8 Attic

This directory contains non-canonical Step 8 recovery / utility scripts retained for traceability.

## Canonical Step 8 scripts (kept in /scripts)
- patch_step_8_lock_policy_execution_binding_v1.mjs
- patch_step_8_termux_bridge_handshake_types_v1.mjs
- patch_step_8_enforce_canonical_surface_v1.mjs
- patch_step_8_create_enforcer_canonical_surface_v1.mjs
`;
if (!exists(readme)) writeIfChanged(readme, base);

// Prove enforcement + gates (must end with npm run build)
run("node scripts/patch_step_8_enforce_canonical_surface_v1.mjs");
run("CI_ALLOW_DIRTY_TREE=1 ./scripts/gate_ci_termux_v1.sh");
run("CI_ALLOW_DIRTY_TREE=1 ./scripts/gate_ci_termux_v1.sh");
run("npm test");
run("npm run build");
