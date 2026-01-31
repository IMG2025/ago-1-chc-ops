#!/usr/bin/env node
/**
 * Phase 20 (authoritative) — Tenant parity tools (readById + search) + smoke20.
 *
 * Guarantees:
 *  - Adds tenant tools without fragile regex edits of individual entries.
 *  - Uses canonical helper readTenantRegistry() already present in server.mjs (Phase 19).
 *  - Idempotent: re-run safe, no duplicate blocks.
 *  - Required gates: node --check + npm run build + npm run mcp:smoke20
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev === next) { console.log("No changes needed:", p); return false; }
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
const pkgPath = path.join(ROOT, "package.json");
const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase20.mjs");

if (!fs.existsSync(serverPath)) throw new Error("Missing: " + serverPath);
if (!fs.existsSync(pkgPath)) throw new Error("Missing: " + pkgPath);

let src = read(serverPath);

const MARK = "PHASE20_TENANT_PARITY_TOOLS_V1";
if (src.includes(MARK)) {
  console.log("Already applied:", MARK);
} else {
  // Safety: require canonical helper present (we restored to phase19 baseline which has it)
  if (!src.includes("function readTenantRegistry(") && !src.includes("readTenantRegistry(")) {
    throw new Error("Expected helper missing: readTenantRegistry(). Unsafe to continue.");
  }

  // Anchor inside TOOL_REGISTRY object literal
  const toolRegIdx = src.indexOf("const TOOL_REGISTRY");
  if (toolRegIdx < 0) throw new Error("Anchor not found: const TOOL_REGISTRY");

  const braceIdx = src.indexOf("{", toolRegIdx);
  if (braceIdx < 0) throw new Error("Anchor not found: TOOL_REGISTRY opening {");

  // Insert our block right after the opening brace to avoid commas/order issues
  const insertAt = braceIdx + 1;

  const block = `
  // ${MARK}
  // Tenant parity tools: readById/search for each tenant registry.
  "chc.artifact_registry.readById": {
    description: "Return a CHC artifact by id.",
    handler: async ({ args, ctx }) => {
      const id = args?.id;
      if (!id) throw new Error("Missing args.id");
      const reg = readTenantRegistry("chc");
      const hit = reg.artifacts.find(a => a && a.id === id) || null;
      if (!hit) throw new Error("Not found: " + id);
      return hit;
    }
  },
  "chc.artifact_registry.search": {
    description: "Search CHC artifacts by query string.",
    handler: async ({ args, ctx }) => {
      const q = String(args?.q || "").trim();
      const reg = readTenantRegistry("chc");
      const qq = q.toLowerCase();
      const results = reg.artifacts.filter(a => {
        const id = String(a?.id || "").toLowerCase();
        const name = String(a?.name || "").toLowerCase();
        return qq ? (id.includes(qq) || name.includes(qq)) : true;
      });
      return { q, count: results.length, results };
    }
  },

  "ciag.artifact_registry.readById": {
    description: "Return a CIAG artifact by id.",
    handler: async ({ args, ctx }) => {
      const id = args?.id;
      if (!id) throw new Error("Missing args.id");
      const reg = readTenantRegistry("ciag");
      const hit = reg.artifacts.find(a => a && a.id === id) || null;
      if (!hit) throw new Error("Not found: " + id);
      return hit;
    }
  },
  "ciag.artifact_registry.search": {
    description: "Search CIAG artifacts by query string.",
    handler: async ({ args, ctx }) => {
      const q = String(args?.q || "").trim();
      const reg = readTenantRegistry("ciag");
      const qq = q.toLowerCase();
      const results = reg.artifacts.filter(a => {
        const id = String(a?.id || "").toLowerCase();
        const name = String(a?.name || "").toLowerCase();
        return qq ? (id.includes(qq) || name.includes(qq)) : true;
      });
      return { q, count: results.length, results };
    }
  },

  "hospitality.artifact_registry.readById": {
    description: "Return a Hospitality artifact by id.",
    handler: async ({ args, ctx }) => {
      const id = args?.id;
      if (!id) throw new Error("Missing args.id");
      const reg = readTenantRegistry("hospitality");
      const hit = reg.artifacts.find(a => a && a.id === id) || null;
      if (!hit) throw new Error("Not found: " + id);
      return hit;
    }
  },
  "hospitality.artifact_registry.search": {
    description: "Search Hospitality artifacts by query string.",
    handler: async ({ args, ctx }) => {
      const q = String(args?.q || "").trim();
      const reg = readTenantRegistry("hospitality");
      const qq = q.toLowerCase();
      const results = reg.artifacts.filter(a => {
        const id = String(a?.id || "").toLowerCase();
        const name = String(a?.name || "").toLowerCase();
        return qq ? (id.includes(qq) || name.includes(qq)) : true;
      });
      return { q, count: results.length, results };
    }
  },
`;

  src = src.slice(0, insertAt) + block + src.slice(insertAt);
  writeIfChanged(serverPath, src);
}

// Ensure smoke20 script exists (authoritative + tolerant of response shape)
const smokeSrc = `#!/usr/bin/env node
import assert from "node:assert";

const BASE = process.env.MCP_BASE_URL || "http://127.0.0.1:8787";

async function getTools() {
  const r = await fetch(\`\${BASE}/tools\`);
  assert.equal(r.status, 200, "/tools status");
  const j = await r.json();
  const names = (j.tools || []).map(t => t.name);
  return names;
}

async function postTool(tool, tenant, args) {
  const r = await fetch(\`\${BASE}/tool\`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tool,
      args: args || {},
      ctx: { tenant, actor: "smoke", purpose: "phase20", classification: "internal", traceId: "t20-" + tenant }
    })
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

function normalizeArtifactId(j) {
  // Some handlers may return artifact directly as data; others may wrap under data.artifact.
  const d = j?.data;
  return d?.id ?? d?.artifact?.id;
}

(async () => {
  const names = await getTools();

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

  // Seed markers via readById
  const checks = [
    ["chc", "TENANT-SEED-CHC"],
    ["ciag", "TENANT-SEED-CIAG"],
    ["hospitality", "TENANT-SEED-HOSPITALITY"]
  ];

  for (const [tenant, id] of checks) {
    const { status, j } = await postTool(\`\${tenant}.artifact_registry.readById\`, tenant, { id });
    assert.equal(status, 200, tenant + " readById status");
    assert.equal(j.ok, true, tenant + " ok");
    assert.equal(normalizeArtifactId(j), id, tenant + " seed id mismatch");
  }

  // Search must return at least 1 result for "ECF" (present as ECF-1 id)
  for (const tenant of ["chc", "ciag", "hospitality"]) {
    const { status, j } = await postTool(\`\${tenant}.artifact_registry.search\`, tenant, { q: "ECF" });
    assert.equal(status, 200, tenant + " search status");
    assert.equal(j.ok, true, tenant + " search ok");
    assert((j.data?.count ?? 0) >= 1, tenant + " search count < 1");
  }

  console.log(JSON.stringify({
    ok: true,
    phase: 20,
    base: BASE,
    observed: { requiredTools: required.length }
  }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
writeIfChanged(smokePath, smokeSrc);
try { fs.chmodSync(smokePath, 0o755); } catch {}

// Ensure package.json script exists
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke20"]) {
  pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
} else {
  console.log("No changes needed: package.json (mcp:smoke20 present)");
}

// Required gates
console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");

console.log("== Running smoke20 (required gate) ==");
run("npm run mcp:smoke20");
