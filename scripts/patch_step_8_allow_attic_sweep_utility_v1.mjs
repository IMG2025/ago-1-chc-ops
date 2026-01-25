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

const ENFORCER = "scripts/patch_step_8_enforce_canonical_surface_v1.mjs";
if (!fs.existsSync(ENFORCER)) throw new Error(`Missing: ${ENFORCER}`);

let src = read(ENFORCER);

// Enforcer has: const ALLOWED = new Set([...CANON, "...", "..."]);
const utility = "patch_step_8_attic_stray_step8_scripts_v1.mjs";

if (!src.includes(utility)) {
  const marker = 'const ALLOWED = new Set([...CANON, "patch_step_8_enforce_canonical_surface_v1.mjs", "patch_step_8_create_enforcer_canonical_surface_v1.mjs"]';
  const idx = src.indexOf(marker);

  if (idx === -1) {
    throw new Error("Invariant: could not locate ALLOWED set anchor in enforcer (script layout changed).");
  }

  // Insert utility into ALLOWED set deterministically
  src = src.replace(
    marker,
    marker + `, "${utility}"`
  );

  writeIfChanged(ENFORCER, src);
  console.log(`OK: enforcer allowlisted ${utility}.`);
} else {
  console.log(`OK: enforcer already allowlists ${utility} (no changes).`);
}

// Prove enforcement + gates (must end with npm run build)
run(`node ${ENFORCER}`);
run(`node ${ENFORCER}`);
run("./scripts/gate_ci_termux_v1.sh");
run("./scripts/gate_ci_termux_v1.sh");
run("npm test");
run("npm run build");
