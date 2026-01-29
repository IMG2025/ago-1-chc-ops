#!/usr/bin/env node
/**
 * patch_add_mcp_phase3_smoke_v1.mjs
 * Idempotent patch:
 * - Adds a small MCP client wrapper (callTool + HTTP transport)
 * - Adds a smoke script that calls shared.artifact_registry.read
 * - Adds npm script mcp:smoke
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
function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeIfChanged(fp, next) {
  const prev = exists(fp) ? read(fp) : "";
  if (prev === next) return false;
  mkdirp(path.dirname(fp));
  fs.writeFileSync(fp, next);
  return true;
}

function upsertPackageScript(scriptName, scriptCmd) {
  const pkgPath = p("package.json");
  if (!exists(pkgPath)) throw new Error("package.json not found");
  const pkg = JSON.parse(read(pkgPath));
  pkg.scripts ||= {};
  if (pkg.scripts[scriptName] === scriptCmd) return false;
  pkg.scripts[scriptName] = scriptCmd;
  return writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function main() {
  console.log("== MCP Phase 3: CHC Ops consumes shared tool via gateway ==");

  const changed = [];

  // 1) Client wrapper: picks transport and calls gateway
  const clientTs = `import { callTool } from "./gateway";
import type { ToolRequest, ToolResponse } from "./envelopes";
import { createHttpToolTransport } from "./transports/httpTransport";

export type McpClientConfig = {
  baseUrl: string; // e.g. http://127.0.0.1:8787
};

export function createMcpClient(cfg: McpClientConfig) {
  const transport = createHttpToolTransport({ baseUrl: cfg.baseUrl });

  return {
    async invoke<T = unknown>(req: ToolRequest): Promise<ToolResponse<T>> {
      return (await callTool(transport, req)) as ToolResponse<T>;
    }
  };
}
`;
  if (writeIfChanged(p("src", "mcp", "client.ts"), clientTs)) changed.push("src/mcp/client.ts");

  // 2) Smoke runner (TypeScript, executed via tsx or node after build output exists)
  // We'll implement as a small TS file and run it with node via compiled dist if repo has one.
  // If repo doesn't emit dist, we'll run via ts-node/tsx only if available.
  // To avoid new deps, we generate a tiny JS runner instead.
  const smokeJs = `#!/usr/bin/env node
import { createMcpClient } from "../src/mcp/client.js";

function traceId() {
  return "t-" + Math.random().toString(16).slice(2);
}

async function main() {
  const baseUrl = process.env.MCP_SHARED_BASE_URL || "http://127.0.0.1:8787";
  const client = createMcpClient({ baseUrl });

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

  const res = await client.invoke(req);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
  // Place in scripts so it can be executed without changing runtime packaging assumptions.
  if (writeIfChanged(p("scripts", "mcp_smoke_phase3.mjs"), smokeJs)) changed.push("scripts/mcp_smoke_phase3.mjs");

  // 3) npm script to run smoke (server must be running in another session)
  const scriptChanged = upsertPackageScript("mcp:smoke", "node scripts/mcp_smoke_phase3.mjs");
  if (scriptChanged) changed.push("package.json (scripts.mcp:smoke)");

  console.log("Changed files:", changed.length ? changed : "(no changes; already applied)");

  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
