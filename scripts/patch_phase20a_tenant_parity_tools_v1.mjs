#!/usr/bin/env node
/**
 * Phase 20A — Tenant Parity Tools (v1)
 * - Adds canonical tenant-registry helper layer (no duplication).
 * - Adds tenant parity tools: {read, readById, search} for chc/ciag/hospitality.
 * - Adds smoke20 and npm script mcp:smoke20.
 *
 * Idempotent. Required gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev === next) {
    console.log("No changes needed:", p);
    return false;
  }
  write(p, next);
  console.log("Patched:", p);
  return true;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
const pkgPath = path.join(ROOT, "package.json");
const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase20.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}
if (!fs.existsSync(pkgPath)) {
  console.error("Missing:", pkgPath);
  process.exit(1);
}

let src = read(serverPath);

const MARK = "/* PHASE20A_TENANT_PARITY_V1 */";
if (!src.includes(MARK)) {
  // Anchor: TOOL_REGISTRY declaration must exist
  const regAnchor = "const TOOL_REGISTRY = {";
  const aIdx = src.indexOf(regAnchor);
  if (aIdx < 0) {
    console.error("Anchor not found: const TOOL_REGISTRY = {");
    process.exit(1);
  }

  // Anchor: we expect readTenantRegistry() to exist from Phase 19
  if (!src.includes("function readTenantRegistry(")) {
    console.error("Expected helper missing: readTenantRegistry(). Unsafe to continue.");
    process.exit(1);
  }

  // Insert helper funcs just BEFORE TOOL_REGISTRY (stable place)
  const insertHelpers = `
${MARK}
const TENANT_IDS = ["shared","chc","ciag","hospitality"];

function getRegistryForTenant(tenant) {
  // Uses Phase19 canonical helper
  return readTenantRegistry(tenant);
}

function normalizeArtifacts(reg) {
  const artifacts = Array.isArray(reg?.artifacts) ? reg.artifacts : [];
  return artifacts;
}

function registryReadById(tenant, id) {
  if (!id) throw new Error("Missing args.id");
  const reg = getRegistryForTenant(tenant);
  const artifacts = normalizeArtifacts(reg);
  const artifact = artifacts.find(a => a?.id === id) || null;
  return {
    schema: "artifact-registry.readById.v1",
    tenant: reg?.tenant || tenant,
    id,
    artifact
  };
}

function registrySearch(tenant, q) {
  const query = String(q || "").toLowerCase();
  const reg = getRegistryForTenant(tenant);
  const artifacts = normalizeArtifacts(reg);
  const hits = query
    ? artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(query))
    : artifacts;
  return {
    schema: "artifact-registry.search.v1",
    tenant: reg?.tenant || tenant,
    q: String(q || ""),
    count: hits.length,
    artifacts: hits
  };
}
/* /PHASE20A_TENANT_PARITY_V1 */
`;

  // Put helpers right before TOOL_REGISTRY block
  src = src.slice(0, aIdx) + insertHelpers + "\n" + src.slice(aIdx);

  // Now inject tenant parity tool entries into TOOL_REGISTRY
  // We will insert just before the closing "};" of TOOL_REGISTRY (first occurrence after start)
  const startIdx = src.indexOf(regAnchor);
  if (startIdx < 0) {
    console.error("TOOL_REGISTRY start not found after helper insert.");
    process.exit(1);
  }
  const endIdx = src.indexOf("\n};", startIdx);
  if (endIdx < 0) {
    console.error("TOOL_REGISTRY end not found.");
    process.exit(1);
  }

  const parityBlock = `
  // Phase 20A: tenant parity tools
  "chc.artifact_registry.readById": {
    description: "Read CHC artifact by id.",
    handler: async ({ args, ctx }) => registryReadById("chc", args?.id)
  },
  "chc.artifact_registry.search": {
    description: "Search CHC artifacts.",
    handler: async ({ args, ctx }) => registrySearch("chc", args?.q)
  },

  "ciag.artifact_registry.readById": {
    description: "Read CIAG artifact by id.",
    handler: async ({ args, ctx }) => registryReadById("ciag", args?.id)
  },
  "ciag.artifact_registry.search": {
    description: "Search CIAG artifacts.",
    handler: async ({ args, ctx }) => registrySearch("ciag", args?.q)
  },

  "hospitality.artifact_registry.readById": {
    description: "Read Hospitality artifact by id.",
    handler: async ({ args, ctx }) => registryReadById("hospitality", args?.id)
  },
  "hospitality.artifact_registry.search": {
    description: "Search Hospitality artifacts.",
    handler: async ({ args, ctx }) => registrySearch("hospitality", args?.q)
  },
`;

  src = src.slice(0, endIdx) + parityBlock + src.slice(endIdx);

  writeIfChanged(serverPath, src);
} else {
  console.log("Already applied marker:", MARK);
}

// ---- Add smoke20 script file (idempotent) ----
ensureDir(path.dirname(smokePath));

const smoke20 = `#!/usr/bin/env node
import assert from "node:assert/strict";

const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

async function getJson(url) {
  const r = await fetch(url);
  const j = await r.json();
  return { status: r.status, j };
}

async function postTool(tool, tenant, args = {}) {
  const r = await fetch(\`\${BASE}/tool\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tool,
      args,
      ctx: {
        tenant,
        actor: "smoke",
        purpose: "phase20",
        classification: "internal",
        traceId: "t-" + tenant + "-" + tool
      }
    })
  });
  const j = await r.json();
  return { status: r.status, j };
}

(async () => {
  const { j: toolsJ } = await getJson(\`\${BASE}/tools\`);
  const names = (toolsJ.tools || []).map(t => t.name);

  const required = [
    "shared.artifact_registry.read",
    "shared.artifact_registry.readById",
    "shared.artifact_registry.search",
    "chc.artifact_registry.read",
    "chc.artifact_registry.readById",
    "chc.artifact_registry.search",
    "ciag.artifact_registry.read",
    "ciag.artifact_registry.readById",
    "ciag.artifact_registry.search",
    "hospitality.artifact_registry.read",
    "hospitality.artifact_registry.readById",
    "hospitality.artifact_registry.search"
  ];

  for (const t of required) assert(names.includes(t), "Missing tool: " + t);

  // Each tenant must resolve its seed marker via readById
  const checks = [
    ["chc", "TENANT-SEED-CHC"],
    ["ciag", "TENANT-SEED-CIAG"],
    ["hospitality", "TENANT-SEED-HOSPITALITY"]
  ];

  for (const [tenant, id] of checks) {
    const { status, j } = await postTool(\`\${tenant}.artifact_registry.readById\`, tenant, { id });
    assert.equal(status, 200, tenant + " readById status");
    assert.equal(j.ok, true, tenant + " ok");
    assert.equal(j.data?.artifact?.id, id, tenant + " seed id mismatch");
  }

  // Search must return at least 1 result for "ECF"
  for (const tenant of ["chc","ciag","hospitality"]) {
    const { status, j } = await postTool(\`\${tenant}.artifact_registry.search\`, tenant, { q: "ECF" });
    assert.equal(status, 200, tenant + " search status");
    assert.equal(j.ok, true, tenant + " search ok");
    assert((j.data?.count ?? 0) >= 1, tenant + " search count < 1");
  }

  console.log(JSON.stringify({
    ok: true,
    phase: 20,
    base: BASE,
    observed: {
      requiredTools: required.length,
      toolsCount: names.length
    }
  }, null, 2));
})().catch((e) => {
  console.error("Error:", e?.stack || e);
  process.exit(1);
});
`;

writeIfChanged(smokePath, smoke20);
try { fs.chmodSync(smokePath, 0o755); } catch {}

// ---- Ensure package.json has mcp:smoke20 ----
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (pkg.scripts["mcp:smoke20"] !== "node scripts/mcp_smoke_phase20.mjs") {
  pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
} else {
  console.log("No changes needed:", pkgPath);
}

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
