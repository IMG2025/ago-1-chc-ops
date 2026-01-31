#!/usr/bin/env node
/**
 * Phase 20C — Fix smoke20 seed assertion to support both response shapes:
 *   - { ok, data: { id } }
 *   - { ok, data: { artifact: { id } } }
 * Idempotent. Required gate: npm run build
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd){ execSync(cmd, { stdio: "inherit" }); }
function read(p){ return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next){
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev === next) { console.log("No changes needed:", p); return false; }
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const FILE = "scripts/mcp_smoke_phase20.mjs";
if (!fs.existsSync(FILE)) { console.error("Missing:", FILE); process.exit(1); }

let src = read(FILE);

// 1) Ensure extractId helper exists (insert after imports)
if (!src.includes("function extractId(")) {
  const m = src.match(/(^\s*import[\s\S]*?\n)(?=\s*(const|let|function)\s+)/m);
  if (!m) { console.error("Unsafe: could not locate import section anchor"); process.exit(1); }

  src = src.replace(
    m[1],
    `${m[1]}
function extractIdFromReadByIdResponse(j){
  // Supports:
  //  - { ok, data: { id } }
  //  - { ok, data: { artifact: { id } } }
  return j?.data?.id ?? j?.data?.artifact?.id;
}

`
  );
}

// 2) Replace the brittle assertion line (exact pattern)
const target =
  "assert.equal(j.data?.artifact?.id, id, tenant + \" seed id mismatch\");";

if (!src.includes(target)) {
  console.error("Unsafe: expected assertion line not found. Refusing to patch.");
  process.exit(1);
}

src = src.replace(
  target,
  "assert.equal(extractIdFromReadByIdResponse(j), id, tenant + \" seed id mismatch\");"
);

writeIfChanged(FILE, src);

console.log("== Running build (required gate) ==");
run("npm run build");
