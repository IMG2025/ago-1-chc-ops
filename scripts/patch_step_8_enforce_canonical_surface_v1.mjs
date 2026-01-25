#!/usr/bin/env node
/**
 * Step 8 Canonical Surface Enforcer (v1)
 *
 * Purpose:
 * - Ensure Step 8 remains operationally clean: only canonical scripts in /scripts.
 * - Allow attic scripts for traceability.
 *
 * Guardrails:
 * - Deterministic + idempotent.
 * - Does not run builds; it enforces repo layout invariants only.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function readDir(p) { return fs.readdirSync(p, { withFileTypes: true }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPTS = "scripts";
const ATTIC = path.join(SCRIPTS, "_attic", "step-8");

const CANON = new Set([
  "patch_step_8_lock_policy_execution_binding_v1.mjs",
  "patch_step_8_termux_bridge_handshake_types_v1.mjs"
]);

if (!fs.existsSync(SCRIPTS)) {
  console.error("FAIL: missing scripts/ directory");
  process.exit(1);
}

if (!fs.existsSync(ATTIC)) {
  console.error("FAIL: missing scripts/_attic/step-8 (expected for hygiene)");
  process.exit(1);
}

// Find Step-8 scripts in scripts/
const entries = readDir(SCRIPTS)
  .filter(d => d.isFile() && d.name.startsWith("patch_step_8_") && d.name.endsWith(".mjs"))
  .map(d => d.name);

// Enforcer is allowed to exist in /scripts in addition to canonical patch scripts
const ALLOWED = new Set([...CANON, "patch_step_8_enforce_canonical_surface_v1.mjs", "patch_step_8_create_enforcer_canonical_surface_v1.mjs"], "patch_step_8_attic_stray_step8_scripts_v1.mjs");

const unexpected = entries.filter(n => !ALLOWED.has(n));

if (unexpected.length) {
  console.error("FAIL: unexpected Step-8 scripts present in scripts/ (move to scripts/_attic/step-8):");
  for (const n of unexpected) console.error(" - " + n);
  process.exit(1);
}

// Ensure canonical scripts exist
for (const n of CANON) {
  const p = path.join(SCRIPTS, n);
  if (!fs.existsSync(p)) {
    console.error("FAIL: missing canonical Step-8 script: " + p);
    process.exit(1);
  }
}

console.log("OK: Step 8 canonical surface enforced (scripts clean; attic present).");
