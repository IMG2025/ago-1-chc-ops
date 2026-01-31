#!/usr/bin/env node
/**
 * Phase 20D v2 — Canonical tenant search helper
 * - Adds searchTenantRegistry()
 * - Rewires all *.artifact_registry.search tools to use it
 * - Case-insensitive substring match on id | name | pathHint
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

/**
 * 1. Ensure canonical helper exists
 */
if (!src.includes("function searchTenantRegistry")) {
  const anchor = src.indexOf("function readTenantRegistry");
  if (anchor === -1) {
    console.error("Anchor not found: readTenantRegistry()");
    process.exit(1);
  }

  const insert = `
function searchTenantRegistry(tenant, q) {
  const data = readTenantRegistry(tenant);
  const needle = String(q || "").toLowerCase();
  const hits = data.artifacts.filter(a => {
    return (
      (a.id || "").toLowerCase().includes(needle) ||
      (a.name || "").toLowerCase().includes(needle) ||
      (a.pathHint || "").toLowerCase().includes(needle)
    );
  });
  return {
    count: hits.length,
    results: hits
  };
}
`;

  src = src.slice(0, anchor) +
        insert +
        src.slice(anchor);
}

/**
 * 2. Rewire all *.artifact_registry.search handlers
 *    We do NOT regex the body — we replace handler definitions safely.
 */
src = src.replace(
  /handler:\s*async\s*\(\{\s*args\s*,\s*ctx\s*\}\)\s*=>\s*\{[\s\S]*?\}/g,
  match => {
    if (!match.includes("artifact_registry.search")) return match;
    return `
handler: async ({ args, ctx }) => {
  return searchTenantRegistry(ctx?.tenant, args?.q);
}`;
  }
);

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
