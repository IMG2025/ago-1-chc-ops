#!/usr/bin/env node
/**
 * patch_fix_missing_hospitality_export_v1.mjs
 * Idempotent patch:
 * - Removes/neutralizes the hard export of "hospitality-ago-1" from src/index.ts
 * - Prevents baseline build failure due to missing cross-repo dependency
 * - Ends with npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }

const ROOT = sh("git rev-parse --show-toplevel");
const fp = path.join(ROOT, "src", "index.ts");

function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev === next) return false;
  fs.writeFileSync(p, next);
  return true;
}

function main() {
  if (!exists(fp)) {
    console.error("ERROR: src/index.ts not found; cannot apply patch safely.");
    process.exit(1);
  }

  const prev = read(fp);

  // Remove any direct export from "hospitality-ago-1" (common variants)
  // Example: export { registerHospitality } from "hospitality-ago-1";
  // Also handle single quotes and trailing spaces.
  const lines = prev.split(/\r?\n/);
  const filtered = [];
  let removed = 0;

  for (const line of lines) {
    const normalized = line.trim();
    const isBad =
      /^export\s+\{[^}]*\}\s+from\s+["']hospitality-ago-1["'];?\s*$/.test(normalized) ||
      /^export\s+\*\s+from\s+["']hospitality-ago-1["'];?\s*$/.test(normalized);

    if (isBad) {
      removed += 1;
      continue;
    }
    filtered.push(line);
  }

  // If we removed something, add a clear comment once (idempotent)
  let next = filtered.join("\n");
  const marker = "/* NOTE: hospitality-ago-1 export intentionally decoupled */";
  if (removed > 0 && !next.includes(marker)) {
    next = next.replace(/\s*$/, "");
    next += "\n" + marker + "\n";
    next += "// CHC Ops must not hard-depend on other AGO-1 repos. Use MCP tool plane via Nexus instead.\n";
  }

  const changed = writeIfChanged(fp, next);
  console.log(changed ? "Patched src/index.ts" : "No changes needed (already patched).");

  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
