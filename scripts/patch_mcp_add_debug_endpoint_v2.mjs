#!/usr/bin/env node
/**
 * patch_mcp_add_debug_endpoint_v2.mjs
 * Phase 9F:
 * - Adds GET /debug to mcp-shared-server to expose runtime TOOL_REGISTRY keys.
 * - Adds a startup log line showing registry keys.
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
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

const toolsNeedle = 'parsed.pathname === "/tools"';
const tIdx = src.indexOf(toolsNeedle);
if (tIdx < 0) {
  console.error("Anchor not found: /tools route not present. Aborting.");
  process.exit(1);
}

// Insert /debug right after /tools block
if (!src.includes('parsed.pathname === "/debug"')) {
  const blockEnd = src.indexOf("\n  }\n", tIdx);
  if (blockEnd < 0) {
    console.error("Could not locate end of /tools route block.");
    process.exit(1);
  }

  const debugBlock =
`  if (req.method === "GET" && parsed.pathname === "/debug") {
    const registryKeys = Object.keys(TOOL_REGISTRY || {}).sort();
    return json(res, 200, {
      ok: true,
      schema: "mcp.debug.v1",
      cwd: process.cwd(),
      repoRoot: ROOT,
      argv: process.argv,
      registryKeys
    });
  }

`;

  src = src.slice(0, blockEnd + "\n  }\n".length) + debugBlock + src.slice(blockEnd + "\n  }\n".length);
}

// Add startup log line once
if (!src.includes('console.log("MCP registry keys:"')) {
  src = src.replace(
    /server\.listen\s*PORT\s*,\s*\(\s*=>\s*\{\s*/m,
    (m) => m + '\n  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY || {}).sort());\n'
  );
}

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
