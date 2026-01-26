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
const ATTIC = path.join(SCRIPTS, "_attic", "ci");
ensureDir(ATTIC);

const ONEOFFS = [
  "patch_ci_gate_no_login_shell_v1.mjs",
  "patch_ci_gate_allow_dirty_tree_v1.mjs",
];

function moveToAttic(name) {
  const src = path.join(SCRIPTS, name);
  if (!exists(src)) return false;
  const dst = path.join(ATTIC, name);
  if (!exists(dst)) fs.renameSync(src, dst);
  else fs.rmSync(src, { force: true });
  return true;
}

let moved = 0;
for (const f of ONEOFFS) if (moveToAttic(f)) moved++;

const readme = path.join(ATTIC, "README.md");
const readmeTxt = `# CI Attic

This directory contains one-off patch scripts used to repair CI/gate behavior on Termux.
They are retained for traceability but are not part of the canonical execution path.

## Canonical CI entrypoints
- scripts/gate_ci_termux_v1.sh

## Why attic?
- Reduce operational noise in /scripts
- Keep the repo’s “happy path” obvious and repeatable
`;
writeIfChanged(readme, readmeTxt);

console.log(`OK: moved ${moved} CI one-off patch script(s) to ${ATTIC}.`);

// Gates
run("./scripts/gate_ci_termux_v1.sh");
run("./scripts/gate_ci_termux_v1.sh");

// Must end with npm run build
run("npm test");
run("npm run build");
