#!/usr/bin/env node
/**
 * Phase 19 — add mcp:smoke19 script
 * Idempotent. Ends with npm run build.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const p = "package.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));

j.scripts ||= {};

if (!j.scripts["mcp:smoke19"]) {
  j.scripts["mcp:smoke19"] = "node scripts/mcp_smoke_phase19.mjs";
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
  console.log("Patched: package.json (added mcp:smoke19)");
} else {
  console.log("No change: mcp:smoke19 already present");
}

console.log("== Running build (required) ==");
run("npm run build");
