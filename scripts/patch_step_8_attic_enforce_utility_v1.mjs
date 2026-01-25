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

const name = "patch_step_8_enforce_canonical_surface_v1.mjs";
const src = path.join(SCRIPTS, name);
const dst = path.join(ATTIC, name);

if (exists(src)) {
  if (!exists(dst)) fs.renameSync(src, dst);
  else fs.rmSync(src, { force: true });
}

console.log("OK: Step 8 enforce utility moved to attic (or already moved).");

// Prove canonical scripts still execute
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");

// Gates
run("npm test");
run("npm run build");
