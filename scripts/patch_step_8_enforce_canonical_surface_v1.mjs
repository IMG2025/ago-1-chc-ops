#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPTS = "scripts";
const ATTIC = path.join(SCRIPTS, "_attic", "step-8");
ensureDir(ATTIC);

const KEEP = new Set([
  "patch_step_8_lock_policy_execution_binding_v1.mjs",
  "patch_step_8_termux_bridge_handshake_types_v1.mjs",
]);

const MOVE = [
  "patch_step_8_finalize_canonical_hygiene_v1.mjs",
  "patch_step_8_fix_finalize_canonical_hygiene_syntax_v1.mjs",
];

function safeMove(name) {
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
for (const f of MOVE) if (safeMove(f)) moved++;

const readme = path.join(ATTIC, "README.md");
const note = `# Step 8 Attic

This directory contains non-canonical Step 8 repair/cleanup scripts retained for traceability.

## Canonical Step 8 scripts (kept in /scripts)
- patch_step_8_lock_policy_execution_binding_v1.mjs
- patch_step_8_termux_bridge_handshake_types_v1.mjs
`;
fs.writeFileSync(readme, note);

console.log(`OK: enforced canonical Step 8 surface. Moved ${moved} file(s) to ${ATTIC}.`);

// Prove canonical scripts still execute (idempotent)
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
