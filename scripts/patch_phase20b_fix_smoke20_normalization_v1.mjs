#!/usr/bin/env node
/**
 * Phase 20 fix — normalize readById responses before asserting.
 * Handles both { ok, data:{id} } and already-unwrapped {id}.
 * Idempotent. Ends with npm run build.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd){ execSync(cmd, { stdio: "inherit" }); }
function read(p){ return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next){
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev === next) {
    console.log("No changes needed:", p);
    return false;
  }
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

// Insert normalizer once
if (!src.includes("function normalizeReadById")) {
  src = src.replace(
    /(^\s*import[\s\S]*?\n)(\s*const\s+BASE\s*=)/m,
    `$1
function normalizeReadById(resp){
  // Accepts either full MCP response or already-unwrapped data
  if (!resp) return undefined;
  if (resp.id) return resp.id;          // already data
  if (resp.data?.id) return resp.data.id; // full response
  return undefined;
}

$2`
  );
}

// Replace any chc/ciag/hosp seed id assignment with normalization
src = src.replace(
  /(const\s+chcSeedId\s*=\s*)([^;]+);/g,
  `$1normalizeReadById($2);`
);
src = src.replace(
  /(const\s+ciagSeedId\s*=\s*)([^;]+);/g,
  `$1normalizeReadById($2);`
);
src = src.replace(
  /(const\s+hospSeedId\s*=\s*)([^;]+);/g,
  `$1normalizeReadById($2);`
);

writeIfChanged(SMOKE, src);

console.log("== Running build (required gate) ==");
run("npm run build");
