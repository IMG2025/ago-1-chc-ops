#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const SCRIPTS = path.join(ROOT, "scripts");

// Explicit delete list = deterministic + safe.
// We only remove scripts we already decided are non-canonical.
// This avoids “regex drift” and prevents self-deletion.
const DELETE = [
  "patch_extract_sentinel_core_copy.mjs",
  "patch_fix_sentinel_core_barrels.mjs",
  "patch_fix_sentinel_core_mount_duplicate.mjs",
  "patch_make_workspace_v3_idempotent.mjs",
  "patch_normalize_sentinel_core.mjs",
  "patch_scaffold_sentinel_core_workspace.mjs",

  // v1 is now deprecated; remove it once v2 exists.
  "patch_cleanup_sentinel_core_script_churn_v1.mjs",
];

let removed = 0;
for (const f of DELETE) {
  const p = path.join(SCRIPTS, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { force: true });
    removed++;
  }
}

console.log(`OK: cleanup v2 applied. Removed ${removed}/${DELETE.length} known non-canonical scripts.`);
run("npm run build");
