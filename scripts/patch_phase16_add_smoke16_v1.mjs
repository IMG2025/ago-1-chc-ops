#!/usr/bin/env node
/**
 * patch_phase16_add_smoke16_v1.mjs
 * - Adds scripts/mcp_smoke_phase16.mjs
 * - Adds npm script "mcp:smoke16"
 *
 * Smoke16 validates:
 *  - /health ok
 *  - /tools lists required shared tools
 *  - /capabilities returns schema + requiredCtxFields + tools (must include the same shared tool set)
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
const pkgPath = path.join(ROOT, "package.json");
const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase16.mjs");
mustExist(pkgPath);

const REQUIRED_TOOLS = [
  "shared.artifact_registry.read",
  "shared.artifact_registry.readById",
  "shared.artifact_registry.search"
];

const smoke = `#!/usr/bin/env node
/**
 * Phase 16 smoke: validate /capabilities endpoint + contract
 */
const BASE = process.env.MCP_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function getJson(path) {
  const res = await fetch(BASE + path);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  assert(res.ok, \`\${path} => HTTP \${res.status}\`);
  assert(json && typeof json === "object", \`\${path} => JSON body required\`);
  return json;
}

function sorted(xs) { return [...xs].sort(); }

(async () => {
  const health = await getJson("/health");
  assert(health.ok === true, "/health ok");
  assert(health.service === "mcp-shared-server", "/health service");

  const tools = await getJson("/tools");
  assert(tools.ok === true, "/tools ok");
  const toolNames = (tools.tools || []).map(t => t.name);
  for (const name of ${JSON.stringify(REQUIRED_TOOLS)}) {
    assert(toolNames.includes(name), "/tools includes " + name);
  }

  const cap = await getJson("/capabilities");
  assert(cap.ok === true, "/capabilities ok");
  assert(cap.schema === "mcp.capabilities.v1", "/capabilities schema");
  const req = cap.requiredCtxFields || [];
  for (const f of ["tenant","actor","purpose","classification","traceId"]) {
    assert(req.includes(f), "/capabilities requiredCtxFields includes " + f);
  }

  const capToolNames = (cap.tools || []).map(t => t.name);
  // Capabilities must include all required tools.
  for (const name of ${JSON.stringify(REQUIRED_TOOLS)}) {
    assert(capToolNames.includes(name), "/capabilities includes " + name);
  }

  // Optional consistency check: /tools and /capabilities sets match at least on required tools
  console.log(JSON.stringify({
    ok: true,
    phase: 16,
    base: BASE,
    observed: {
      tools: sorted(toolNames),
      capabilitiesTools: sorted(capToolNames),
      requiredTools: ${JSON.stringify(REQUIRED_TOOLS)}
    }
  }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;

let changed = false;

// Ensure scripts dir exists
fs.mkdirSync(path.dirname(smokePath), { recursive: true });

// Write smoke file (idempotent)
if (writeIfChanged(smokePath, smoke)) {
  fs.chmodSync(smokePath, 0o755);
  changed = true;
}

// Patch package.json scripts
const pkg = JSON.parse(read(pkgPath));
pkg.scripts = pkg.scripts || {};
if (pkg.scripts["mcp:smoke16"] !== "node scripts/mcp_smoke_phase16.mjs") {
  pkg.scripts["mcp:smoke16"] = "node scripts/mcp_smoke_phase16.mjs";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched:", pkgPath, '(added "mcp:smoke16")');
  changed = true;
} else {
  console.log("No changes needed in package.json scripts.");
}

console.log("== Running build (required) ==");
run("npm run build");
