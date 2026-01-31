#!/usr/bin/env node
/**
 * Phase 20 (canonical) — Tenant parity tools (readById/search) + smoke20
 *
 * Guarantees:
 *  - services/mcp-shared-server/server.mjs includes tenant tools:
 *      {tenant}.artifact_registry.readById
 *      {tenant}.artifact_registry.search
 *    for chc/ciag/hospitality
 *  - package.json includes: mcp:smoke20 -> node scripts/mcp_smoke_phase20.mjs
 *
 * Idempotent. Required gates:
 *  - node --check services/mcp-shared-server/server.mjs
 *  - npm run build
 *  - npm run mcp:smoke20
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev === next) return false;
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
if (!exists(serverPath)) throw new Error("Missing: " + serverPath);

let src = read(serverPath);

// Safety: this canonical patch assumes Phase 19+ structure (TOOL_REGISTRY exists)
if (!src.includes("const TOOL_REGISTRY")) {
  throw new Error("Unsafe: server.mjs does not contain TOOL_REGISTRY (unexpected layout).");
}

// Helper: insert new tool entries immediately before the closing "};" of TOOL_REGISTRY
function ensureTool(name, block) {
  if (src.includes(`"${name}"`)) return false;
  const endIdx = src.lastIndexOf("};");
  if (endIdx === -1) throw new Error("Unsafe: could not find TOOL_REGISTRY terminator '};'");
  src = src.slice(0, endIdx) + `  ,\n\n${block}\n` + src.slice(endIdx);
  return true;
}

// Tenant readById/search share the same semantics as shared.* but using readRegistryFile(tenant)
function toolReadById(tenant) {
  const tool = `${tenant}.artifact_registry.readById`;
  return {
    name: tool,
    block: `"${tool}": {
      version: "1.0.0",
      description: "Read ${tenant.toUpperCase()} artifact by id.",
      handler: async ({ args, ctx }) => {
        if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
        const reg = readRegistryFile("${tenant}");
        const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
        return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
      }
    }`
  };
}

function toolSearch(tenant) {
  const tool = `${tenant}.artifact_registry.search`;
  return {
    name: tool,
    block: `"${tool}": {
      version: "1.0.0",
      description: "Search ${tenant.toUpperCase()} artifacts.",
      handler: async ({ args, ctx }) => {
        const q = (args && typeof args.q === "string") ? args.q : "";
        const reg = readRegistryFile("${tenant}");
        const qq = q.trim().toLowerCase();
        const hits = qq
          ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
          : reg.artifacts;
        return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
      }
    }`
  };
}

// Apply tools for each tenant
let changed = false;
for (const tenant of ["chc", "ciag", "hospitality"]) {
  const rb = toolReadById(tenant);
  const se = toolSearch(tenant);
  changed = ensureTool(rb.name, rb.block) || changed;
  changed = ensureTool(se.name, se.block) || changed;
}

if (changed) writeIfChanged(serverPath, src);

// Ensure npm script exists
const pkgPath = path.join(ROOT, "package.json");
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke20"]) {
  pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

// Required gates
console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required gate) ==");
run("npm run build");

console.log("== Running smoke20 (required gate) ==");
run("npm run mcp:smoke20");
