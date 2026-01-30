#!/usr/bin/env node
/**
 * patch_phase16_add_capabilities_endpoint_v1.mjs
 * - Adds GET /capabilities to mcp-shared-server (sibling of /health, /tools, /tool)
 * - Response is stable: schema + requiredCtxFields + tenants + namespace allowlists + tools
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

// Preconditions: authoritative server should have TOOL_REGISTRY and /tools.
if (!src.includes("const TOOL_REGISTRY")) {
  console.error("TOOL_REGISTRY not found in server.mjs — refusing to patch blindly.");
  process.exit(1);
}
if (!src.includes('parsed.pathname === "/tools"')) {
  console.error('Anchor not found: parsed.pathname === "/tools" — refusing to patch blindly.');
  process.exit(1);
}

// Already present => exit cleanly (idempotent).
if (src.includes('parsed.pathname === "/capabilities"')) {
  writeIfChanged(serverPath, src);
  console.log("== Syntax check (required gate) ==");
  run("node --check " + serverPath);
  console.log("== Running build (required) ==");
  run("npm run build");
  process.exit(0);
}

// Insert right after the /tools block.
const toolsIdx = src.indexOf('parsed.pathname === "/tools"');
const toolsBlockEnd = src.indexOf("\n  }\n", toolsIdx);
if (toolsBlockEnd < 0) {
  console.error("Could not locate end of /tools block (expected '\\n  }\\n').");
  process.exit(1);
}

const capabilitiesBlock = `
  if (req.method === "GET" && parsed.pathname === "/capabilities") {
    const tools = Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
      name,
      version: v?.version || "1.0.0",
      description: v?.description || ""
    }));

    return json(res, 200, {
      ok: true,
      schema: "mcp.capabilities.v1",
      requiredCtxFields: ["tenant", "actor", "purpose", "classification", "traceId"],
      tenants: ["shared", "chc", "ciag", "hospitality"],
      namespaceAllowlistByTenant: {
        shared: ["shared."],
        chc: ["shared.", "chc."],
        ciag: ["shared.", "ciag."],
        hospitality: ["shared.", "hospitality."]
      },
      tools
    });
  }

`;

const insertAt = toolsBlockEnd + "\n  }\n".length;
src = src.slice(0, insertAt) + capabilitiesBlock + src.slice(insertAt);

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
