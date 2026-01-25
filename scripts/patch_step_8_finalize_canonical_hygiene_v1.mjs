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

const SCRIPTS_DIR = "scripts";
const ATTIC_DIR = path.join(SCRIPTS_DIR, "_attic", "step-8");
ensureDir(ATTIC_DIR);

// Canonical Step 8 scripts we keep in /scripts
const KEEP = new Set([
  "patch_step_8_lock_policy_execution_binding_v1.mjs",
  "patch_step_8_termux_bridge_handshake_types_v1.mjs",
]);

// Step 8 one-off utilities: move to attic
const MOVE = [
  "patch_step_8_consolidate_governance_hygiene_v1.mjs",
  "patch_step_8_cleanup_emitted_artifacts_v1.mjs",
];

function safeMove(name) {
  const src = path.join(SCRIPTS_DIR, name);
  if (!exists(src)) return false;
  if (KEEP.has(name)) return false;

  const dst = path.join(ATTIC_DIR, name);
  if (!exists(dst)) {
    fs.renameSync(src, dst);
  } else {
    fs.rmSync(src, { force: true });
  }
  return true;
}

let moved = 0;
for (const s of MOVE) {
  if (safeMove(s)) moved += 1;
}

const readme = path.join(ATTIC_DIR, "README.md");
const content =
`# Step 8 Attic

This directory contains non-canonical Step 8 recovery / utility scripts retained for traceability.

## Canonical Step 8 scripts (kept in /scripts)
- patch_step_8_lock_policy_execution_binding_v1.mjs
- patch_step_8_termux_bridge_handshake_types_v1.mjs

## Notes
- One-off consolidation/cleanup utilities are moved here to reduce operational noise.
`;
writeIfChanged(readme, content);

console.log(\`OK: Step 8 canonical hygiene finalized. Moved \${moved} file(s) to \${ATTIC_DIR}.\`);

// Prove canonical scripts still execute
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
