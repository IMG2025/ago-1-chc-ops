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
function moveIfExists(src, dst) {
  if (!fs.existsSync(src)) return;
  ensureDir(path.dirname(dst));
  // idempotent move: if already moved, remove original if it still exists
  if (fs.existsSync(dst)) {
    fs.rmSync(src, { force: true });
    return;
  }
  fs.renameSync(src, dst);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const KEEP = new Set([
  "scripts/patch_step_7_lock_nexus_orchestration_v2.mjs",
  "scripts/patch_step_7_restore_orchestrator_and_generator_canonical_v1.mjs",
  "scripts/patch_step_7_consolidate_and_lock_v1.mjs",
]);

// 1) Quarantine all step-7 attempt scripts (keep only the canonical ones)
const scriptsDir = "scripts";
const atticDir = "scripts/_attic/step-7";
ensureDir(atticDir);

for (const f of fs.readdirSync(scriptsDir)) {
  if (!f.endsWith(".mjs")) continue;
  if (!f.startsWith("patch_step_7_")) continue;
  const p = path.join("scripts", f);
  if (KEEP.has(p)) continue;
  moveIfExists(p, path.join(atticDir, f));
}

// 2) Ensure .tmp is ignored (we already shifted audits to .tmp in places)
const GI = ".gitignore";
const giPrev = fs.existsSync(GI) ? read(GI) : "";
const lines = giPrev.split("\n");
const want = [".tmp/", ".tmp", "scripts/_attic/"];
for (const w of want) {
  if (!lines.includes(w)) lines.push(w);
}
const giNext = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
writeIfChanged(GI, giNext);

// 3) Re-run canonical Step 7 restore (pins generator + orchestrator)
run("node scripts/patch_step_7_restore_orchestrator_and_generator_canonical_v1.mjs");

// 4) Idempotency proof: rerun restore again
run("node scripts/patch_step_7_restore_orchestrator_and_generator_canonical_v1.mjs");

// 5) Full gates
run("npm test");
run("npm run build");

console.log("OK: Step 7 consolidated (attempt scripts quarantined), .gitignore hardened, and gates green.");
