#!/usr/bin/env node
/**
 * patch_fix_mcp_tools_route_stray_brace_v1.mjs
 * Fix mcp-shared-server routing syntax:
 * - Remove the stray `}` that appears immediately after the GET /tools block.
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  if (prev !== next) {
    fs.writeFileSync(p, next);
    console.log("Patched:", p);
    return true;
  }
  console.log("No changes needed; already applied.");
  return false;
}
function mustExist(p) {
  if (!fs.existsSync(p)) {
    console.error("Missing file:", p);
    process.exit(1);
  }
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
mustExist(serverPath);

let src = read(serverPath);

// We remove a stray brace line that comes immediately after the /tools handler.
// Specifically: after `return json(res, 200, { ok: true, tools });` and its closing `}`,
// there must NOT be an extra standalone `}` before the POST /tool block.
const before = src;

src = src.replace(
  /(\n\s*if\s*\(\s*req\.method\s*===\s*["']GET["']\s*&&\s*parsed\.pathname\s*===\s*["']\/tools["']\s*\)\s*\{\s*\n[\s\S]*?\n\s*return\s+json\(\s*res\s*,\s*200\s*,\s*\{\s*ok:\s*true\s*,\s*tools\s*\}\s*\)\s*;\s*\n\s*\}\s*\n)\s*\}\s*\n(\s*if\s*\(\s*req\.method\s*===\s*["']POST["']\s*&&\s*parsed\.pathname\s*===\s*["']\/tool["']\s*\))/m,
  "$1$2"
);

writeIfChanged(serverPath, src);

console.log("== Running build (required) ==");
run("npm run build");
