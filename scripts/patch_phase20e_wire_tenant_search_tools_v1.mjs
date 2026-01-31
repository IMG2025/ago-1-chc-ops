#!/usr/bin/env node
/**
 * Phase 20E — Explicit tenant search wiring
 * - Replaces handlers for *.artifact_registry.search tools only
 * - Uses canonical searchTenantRegistry()
 * - No regex guessing
 * - Idempotent
 * - Required gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd){ execSync(cmd, { stdio: "inherit" }); }
function read(p){ return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next){
  const prev = read(p);
  if (prev === next) {
    console.log("No changes needed:", p);
    return false;
  }
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

function replaceSearchTool(toolName, tenant) {
  const re = new RegExp(
    `(["']${toolName.replace(/\./g,"\\.")}["']\\s*:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\}\\s*,?)`,
    "m"
  );

  if (!re.test(src)) {
    console.error("Tool entry not found:", toolName);
    process.exit(1);
  }

  src = src.replace(re, (_, open, _body, close) =>
    `${open}
  description: "Search ${tenant.toUpperCase()} tenant artifact registry",
  handler: async ({ args, ctx }) => {
    return searchTenantRegistry("${tenant}", args?.q);
  }
${close}`
  );
}

// Explicit, deterministic rewiring
replaceSearchTool("chc.artifact_registry.search", "chc");
replaceSearchTool("ciag.artifact_registry.search", "ciag");
replaceSearchTool("hospitality.artifact_registry.search", "hospitality");

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
