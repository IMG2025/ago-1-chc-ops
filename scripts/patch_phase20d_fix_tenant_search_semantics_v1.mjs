#!/usr/bin/env node
/**
 * Phase 20D — Fix tenant artifact search semantics
 * Search must match against id | name | pathHint (case-insensitive).
 * Idempotent. Required gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd){ execSync(cmd, { stdio: "inherit" }); }
function read(p){ return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next){
  const prev = read(p);
  if (prev === next) { console.log("No changes needed:", p); return false; }
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

// Replace the search handler body (safe pattern match)
const re = /handler:\s*async\s*\(\{\s*args\s*,\s*ctx\s*\}\)\s*=>\s*\{\s*const\s+q\s*=([\s\S]*?)return\s+\{\s*count:/m;

if (!re.test(src)) {
  console.error("Unsafe: search handler pattern not found");
  process.exit(1);
}

src = src.replace(re, () => `
handler: async ({ args, ctx }) => {
  const q = String(args?.q || "").toLowerCase();
  const data = readTenantRegistry(ctx?.tenant);
  const hits = data.artifacts.filter(a => {
    return (
      (a.id || "").toLowerCase().includes(q) ||
      (a.name || "").toLowerCase().includes(q) ||
      (a.pathHint || "").toLowerCase().includes(q)
    );
  });
  return {
    count: hits.length,
    results: hits
  };
}
`);

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
