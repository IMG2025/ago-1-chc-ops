#!/usr/bin/env node
/**
 * patch_fix_mcp_tools_route_braces_v1.mjs
 * Fix Phase 7 route wiring bug where /tools block was nested under /health due to a missing brace.
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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

// Detect the bad pattern: /tools begins before the /health if-block is closed.
// We rewrite just that region to a known-good, stable form.
const badRegionRe = /if\s*\(\s*req\.method\s*===\s*["']GET["']\s*&&\s*parsed\.pathname\s*===\s*["']\/health["']\s*\)\s*\{\s*[\s\S]*?return\s+json\s*\(\s*res\s*,\s*200\s*,\s*\{\s*ok:\s*true\s*,\s*service:\s*["']mcp-shared-server["']\s*,\s*status:\s*["']healthy["']\s*\}\s*\)\s*;\s*(\r?\n)\s*if\s*\(\s*req\.method\s*===\s*["']GET["']\s*&&\s*parsed\.pathname\s*===\s*["']\/tools["']\s*\)\s*\{/m;

if (badRegionRe.test(src)) {
  // Replace only the start of /health block up through the beginning of /tools block,
  // ensuring /health is properly closed before /tools.
  src = src.replace(
    badRegionRe,
    (m, nl) => {
      return [
        `  if (req.method === "GET" && parsed.pathname === "/health") {`,
        `    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });`,
        `  }`,
        ``,
        `  if (req.method === "GET" && parsed.pathname === "/tools") {`
      ].join(nl) + nl;
    }
  );
}

writeIfChanged(serverPath, src);

console.log("== Running build (required) ==");
run("npm run build");
