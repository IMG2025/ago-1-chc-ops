#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const SCRIPTS = path.join(ROOT, "scripts");

// Keep only canonical scripts in this family:
const KEEP = new Set([
  "patch_sentinel_core_public_surface_v7_reset.mjs",
  "patch_cleanup_sentinel_core_script_churn_v1.mjs",
]);

// Remove known churn patterns (we were generating lots of versions).
const REMOVE_PREFIXES = [
  "inspect_sentinel_core_",
  "patch_sentinel_core_",
  "patch_chc_ops_contracts_reexport_sentinel_core",
];

// But do NOT remove the canonical v7 reset script.
function shouldRemove(file) {
  if (!file.endsWith(".mjs")) return false;
  if (KEEP.has(file)) return false;
  return REMOVE_PREFIXES.some(p => file.startsWith(p));
}

if (!fs.existsSync(SCRIPTS)) throw new Error(`Missing scripts dir: ${SCRIPTS}`);

const files = fs.readdirSync(SCRIPTS).filter(f => f.endsWith(".mjs"));
const doomed = files.filter(shouldRemove);

// Safety: never delete if v7 script is missing.
if (!fs.existsSync(path.join(SCRIPTS, "patch_sentinel_core_public_surface_v7_reset.mjs"))) {
  throw new Error("Invariant: canonical v7 reset script is missing; refusing cleanup.");
}

// Delete files
for (const f of doomed) {
  fs.rmSync(path.join(SCRIPTS, f));
}

console.log(`OK: removed ${doomed.length} non-canonical sentinel-core related .mjs scripts.`);

// Optional: add gitignore rule to prevent future scratch scripts from being committed.
// We keep this conservative: only ignore scripts/tmp-*.mjs going forward.
const GI = path.join(ROOT, ".gitignore");
let gi = fs.existsSync(GI) ? fs.readFileSync(GI, "utf8") : "";
const rule = "\n# scratch scripts\nscripts/tmp-*.mjs\n";
if (!gi.includes("scripts/tmp-*.mjs")) {
  gi = gi.trimEnd() + rule;
  fs.writeFileSync(GI, gi);
  console.log("OK: added scripts/tmp-*.mjs to .gitignore");
}

// Final gate
run("npm test");
run("npm run build");
