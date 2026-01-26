#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const GATE = "scripts/gate_ci_termux_v1.sh";
if (!fs.existsSync(GATE)) throw new Error(`Missing: ${GATE}`);

let src = read(GATE);

// Replace `bash -lc` with `bash -c` (non-login) in the run_gate execution.
// Idempotent: if already bash -c, noop.
if (src.includes('bash -lc "$cmd"')) {
  src = src.replaceAll('bash -lc "$cmd"', 'bash -c "$cmd"');
  writeIfChanged(GATE, src);
  console.log("OK: gate runner now uses non-login shell (bash -c).");
} else {
  console.log("OK: gate runner already avoids bash -lc (no changes).");
}

// Prove gates
run("./scripts/gate_ci_termux_v1.sh");
run("./scripts/gate_ci_termux_v1.sh");

// Must end with npm run build
run("npm test");
run("npm run build");
