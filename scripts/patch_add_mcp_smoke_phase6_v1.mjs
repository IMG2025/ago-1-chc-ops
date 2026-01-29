#!/usr/bin/env node
/**
 * patch_add_mcp_smoke_phase6_v1.mjs
 * Adds an idempotent Phase 6 MCP smoke script + package.json entry.
 * Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }
function exists(p) { return fs.existsSync(p); }
function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const pkgPath = path.join(ROOT, "package.json");
const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase6.mjs");

if (!exists(pkgPath)) {
  console.error("package.json not found at repo root:", pkgPath);
  process.exit(1);
}

// 1) Write smoke script (deterministic overwrite is fine; content is canonical)
const smoke = `#!/usr/bin/env node
import { createHttpToolTransport, callTool } from "ago-1-core/mcp";

async function main() {
  const baseUrl = process.env.MCP_BASE_URL || "http://127.0.0.1:8787";

  // health check
  const health = await fetch(\`\${baseUrl}/health\`).then(r => r.json());
  if (!health?.ok) {
    console.error("MCP health check failed:", health);
    process.exit(1);
  }

  const transport = createHttpToolTransport({ baseUrl });

  const req = {
    tool: "shared.artifact_registry.read",
    args: {},
    ctx: {
      tenant: "shared",
      actor: "chc-ops-smoke",
      purpose: "phase6",
      classification: "internal",
      traceId: "chc-ops-phase6"
    }
  };

  const res = await callTool(transport, req);
  console.log(JSON.stringify(res));

  if (!res?.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
write(smokePath, smoke);
try { fs.chmodSync(smokePath, 0o755); } catch {}

// 2) Patch package.json scripts (idempotent)
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (pkg.scripts["mcp:smoke6"] !== "node scripts/mcp_smoke_phase6.mjs") {
  pkg.scripts["mcp:smoke6"] = "node scripts/mcp_smoke_phase6.mjs";
  write(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Updated package.json scripts: mcp:smoke6");
} else {
  console.log("package.json already has mcp:smoke6");
}

// Required build gate
console.log("== Running build (required) ==");
run("npm run build");
