#!/usr/bin/env node
/**
 * patch_fix_mcp_phase3_smoke_v2.mjs
 * Idempotent patch:
 * - Fixes Phase 3 smoke runner to avoid importing TS-only modules
 * - Uses existing JS-resolvable gateway + transport
 * - Keeps repo noEmit-compatible
 * - Ends with npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }

const ROOT = sh("git rev-parse --show-toplevel");
const p = (...xs) => path.join(ROOT, ...xs);

function exists(fp) { return fs.existsSync(fp); }
function read(fp) { return fs.readFileSync(fp, "utf8"); }
function writeIfChanged(fp, next) {
  const prev = exists(fp) ? read(fp) : "";
  if (prev === next) return false;
  fs.writeFileSync(fp, next);
  return true;
}

function main() {
  console.log("== MCP Phase 3 Fix: JS-only smoke runner ==");

  const smokeJs = `#!/usr/bin/env node
import { callTool } from "../src/mcp/gateway.js";
import { createHttpToolTransport } from "../src/mcp/transports/httpTransport.js";

function traceId() {
  return "t-" + Math.random().toString(16).slice(2);
}

async function main() {
  const baseUrl = process.env.MCP_SHARED_BASE_URL || "http://127.0.0.1:8787";
  const transport = createHttpToolTransport({ baseUrl });

  const req = {
    tool: "shared.artifact_registry.read",
    args: {},
    ctx: {
      tenant: "shared",
      actor: "ago-1-chc-ops",
      purpose: "mcp-phase3-smoke",
      classification: "internal",
      traceId: traceId()
    }
  };

  const res = await callTool(transport, req);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;

  const fp = p("scripts", "mcp_smoke_phase3.mjs");
  const changed = writeIfChanged(fp, smokeJs);

  console.log(changed ? "Updated smoke runner." : "Smoke runner already correct.");

  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
