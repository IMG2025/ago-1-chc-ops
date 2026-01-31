#!/usr/bin/env node
/**
 * Phase 20A.2 — Add mcp:smoke20 script (tenant parity smoke)
 * Idempotent. Required gate: npm run build
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke20"]) {
  pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched:", pkgPath, "(added mcp:smoke20)");
} else {
  console.log("No changes needed; mcp:smoke20 already present.");
}

console.log("== Running build (required gate) ==");
run("npm run build");
