#!/usr/bin/env node
/**
 * Phase 20 fix — smoke20 must match authoritative server response shapes
 * Fixes: seed id assertions reading wrong path (undefined).
 * Idempotent. Ends with npm run build.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev === next) { console.log("No changes needed:", p); return false; }
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const SMOKE = "scripts/mcp_smoke_phase20.mjs";
if (!fs.existsSync(SMOKE)) {
  console.error("Missing:", SMOKE);
  process.exit(1);
}

let src = read(SMOKE);

// Replace any incorrect expectations of id at top-level or wrong nesting.
// We normalize by introducing a tiny helper `getIdFromReadById`.
if (!src.includes("function getIdFromReadById")) {
  src = src.replace(
    /(^\s*import[\s\S]*?\n)(\s*const\s+BASE\s*=)/m,
    `$1\nfunction getIdFromReadById(resp){\n  // authoritative contract: { ok:true, data:{ id, ... }, meta:{ traceId } }\n  return resp?.data?.id;\n}\n\n$2`
  );
}

// Now fix any assertion comparing against undefined by forcing it to use helper.
// Common patterns we’ve seen: resp.id, resp.data.artifact.id, resp.data.id?? (already ok)
// We do safe targeted rewrites.
src = src
  .replace(/(\bconst\s+chcById\s*=\s*await\s+[^;]+;[\s\S]*?\b)(?:const\s+chcSeedId\s*=\s*)([^\n;]+);/m,
           `$1const chcSeedId = getIdFromReadById(chcById);`)
  .replace(/(\bconst\s+ciagById\s*=\s*await\s+[^;]+;[\s\S]*?\b)(?:const\s+ciagSeedId\s*=\s*)([^\n;]+);/m,
           `$1const ciagSeedId = getIdFromReadById(ciagById);`)
  .replace(/(\bconst\s+hospById\s*=\s*await\s+[^;]+;[\s\S]*?\b)(?:const\s+hospSeedId\s*=\s*)([^\n;]+);/m,
           `$1const hospSeedId = getIdFromReadById(hospById);`);

// If smoke20 is using resp.id directly anywhere, rewrite to helper.
src = src.replace(/\b(chcById|ciagById|hospById)\.id\b/g, "getIdFromReadById($1)");

// Ensure npm script exists
const pkgPath = "package.json";
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke20"]) pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

writeIfChanged(SMOKE, src);

console.log("== Running build (required gate) ==");
run("npm run build");
