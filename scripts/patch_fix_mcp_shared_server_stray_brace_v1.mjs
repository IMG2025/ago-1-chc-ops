#!/usr/bin/env node
/**
 * patch_fix_mcp_shared_server_stray_brace_v1.mjs
 * Fix: remove a stray closing brace in mcp-shared-server routing block
 * that breaks Node parsing (extra "}" after /tools route).
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

// Target the exact bad pattern shown in your numbered excerpt:
// After the /tools route closes, there is an extra "}" line before the POST /tool route.
const pattern =
/(\n\s*if\s*\(req\.method\s*===\s*"GET"\s*&&\s*parsed\.pathname\s*===\s*"\/tools"\)\s*\{[\s\S]*?\n\s*\}\s*\n)(\s*\}\s*\n)(\s*if\s*\(req\.method\s*===\s*"POST"\s*&&\s*parsed\.pathname\s*===\s*"\/tool"\)\s*\{)/m;

const next = src.replace(pattern, (_m, toolsBlock, _strayBrace, postToolIf) => {
  return `${toolsBlock}${postToolIf}`;
});

writeIfChanged(serverPath, next);

console.log("== Running build (required) ==");
run("npm run build");
