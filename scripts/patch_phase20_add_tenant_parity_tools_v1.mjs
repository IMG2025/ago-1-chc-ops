#!/usr/bin/env node
/**
 * Phase 20A — Tenant parity tools (readById + search) for chc/ciag/hospitality.
 *
 * Adds:
 *  - chc.artifact_registry.readById / search
 *  - ciag.artifact_registry.readById / search
 *  - hospitality.artifact_registry.readById / search
 *
 * Constraints:
 * - Scripted transform only (no hand edits)
 * - Idempotent
 * - Gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = read(p);
  if (prev === next) {
    console.log("No changes needed; already applied.");
    return false;
  }
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

// We require readTenantRegistry() to exist (Phase 19 introduced it).
if (!src.includes("function readTenantRegistry")) {
  console.error("Expected helper missing: readTenantRegistry(). Unsafe to continue.");
  process.exit(1);
}

// Insert new TOOL_REGISTRY entries just before the closing `};` of TOOL_REGISTRY.
const TOOL_REGISTRY_CLOSE_RE = /\n\};\s*\nconst\s+server\s*=\s*http\.createServer/m;
const m = src.match(TOOL_REGISTRY_CLOSE_RE);
if (!m) {
  console.error("Could not locate TOOL_REGISTRY close anchor. Unsafe to continue.");
  process.exit(1);
}

// Helper: check if a tool already exists
function hasTool(name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["']${esc}["']\\s*:\\s*\\{`).test(src);
}

function toolBlock(tenant) {
  const capTenant = tenant === "chc" ? "CHC" : tenant === "ciag" ? "CIAG" : "Hospitality";
  const ns = tenant + ".artifact_registry";
  return `
  "${ns}.readById": {
    description: "Read ${capTenant} artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = readTenantRegistry("${tenant}");
      const artifact = (data.artifacts || []).find(a => a.id === args.id) || null;
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        id: args.id,
        artifact
      };
    }
  },

  "${ns}.search": {
    description: "Search ${capTenant} artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = readTenantRegistry("${tenant}");
      const artifacts = data.artifacts || [];
      const hits = q
        ? artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q))
        : artifacts;
      return {
        schema: "artifact-registry.search.v1",
        tenant: ctx.tenant,
        q,
        count: hits.length,
        artifacts: hits
      };
    }
  },`;
}

const additions = [];
for (const tenant of ["chc", "ciag", "hospitality"]) {
  const readById = `${tenant}.artifact_registry.readById`;
  const search = `${tenant}.artifact_registry.search`;
  if (!hasTool(readById) || !hasTool(search)) additions.push(toolBlock(tenant));
}

if (additions.length) {
  // splice in additions right before TOOL_REGISTRY closes
  src = src.replace(TOOL_REGISTRY_CLOSE_RE, `\n${additions.join("\n")}\n};\nconst server = http.createServer`);
  writeIfChanged(serverPath, src);
} else {
  console.log("No changes needed; tenant parity tools already present.");
}

// Add smoke20 script hook if not present
const pkgPath = path.join(ROOT, "package.json");
if (!fs.existsSync(pkgPath)) {
  console.error("Missing:", pkgPath);
  process.exit(1);
}
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke20"]) {
  pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched:", pkgPath, '(added "mcp:smoke20")');
} else {
  console.log("No changes needed; mcp:smoke20 already present.");
}

// Create smoke20 script if missing
const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase20.mjs");
if (!fs.existsSync(smokePath)) {
  const smoke = `#!/usr/bin/env node
import assert from "node:assert/strict";

const base = process.env.MCP_BASE_URL || "http://127.0.0.1:8787";

function ctx(tenant) {
  return { tenant, actor: "smoke", purpose: "phase20", classification: "internal", traceId: "t20-" + tenant };
}

async function getJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!j.ok) throw new Error("HTTP ok=false: " + JSON.stringify(j));
  return j;
}

async function callTool(tool, tenant, args = {}) {
  const r = await fetch(base + "/tool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args, ctx: ctx(tenant) })
  });
  const j = await r.json();
  return j;
}

(async () => {
  const tools = await getJson(base + "/tools");
  const names = (tools.tools || []).map(t => t.name).sort();

  const required = [
    "shared.artifact_registry.read",
    "shared.artifact_registry.readById",
    "shared.artifact_registry.search",
    "chc.artifact_registry.read",
    "ciag.artifact_registry.read",
    "hospitality.artifact_registry.read",
    "chc.artifact_registry.readById",
    "chc.artifact_registry.search",
    "ciag.artifact_registry.readById",
    "ciag.artifact_registry.search",
    "hospitality.artifact_registry.readById",
    "hospitality.artifact_registry.search"
  ].sort();

  for (const r of required) assert.ok(names.includes(r), "missing tool: " + r);

  // Execute readById against seed markers
  const seeds = [
    ["chc", "TENANT-SEED-CHC"],
    ["ciag", "TENANT-SEED-CIAG"],
    ["hospitality", "TENANT-SEED-HOSPITALITY"]
  ];

  let readCount = 0;
  let searchCount = 0;

  for (const [tenant, seed] of seeds) {
    const byId = await callTool(\`\${tenant}.artifact_registry.readById\`, tenant, { id: seed });
    assert.equal(byId.ok, true, "readById failed for " + tenant);
    assert.equal(byId.data?.artifact?.id, seed, "wrong artifact for " + tenant);
    readCount++;

    const search = await callTool(\`\${tenant}.artifact_registry.search\`, tenant, { q: "TENANT-SEED" });
    assert.equal(search.ok, true, "search failed for " + tenant);
    assert.ok((search.data?.artifacts || []).some(a => a.id === seed), "search missing seed for " + tenant);
    searchCount++;
  }

  console.log(JSON.stringify({
    ok: true,
    phase: 20,
    base,
    toolsCount: names.length,
    observed: { readCount, searchCount }
  }, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
`;
  fs.writeFileSync(smokePath, smoke, "utf8");
  fs.chmodSync(smokePath, 0o755);
  console.log("Created:", smokePath);
} else {
  console.log("No changes needed; smoke20 already exists.");
}

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
