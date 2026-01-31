#!/usr/bin/env node
/**
 * Phase 20 (authoritative) — Tenant parity tools for artifact registries.
 * Adds:
 *  - chc.artifact_registry.readById, chc.artifact_registry.search
 *  - ciag.artifact_registry.readById, ciag.artifact_registry.search
 *  - hospitality.artifact_registry.readById, hospitality.artifact_registry.search
 *
 * Contracts match shared.* shapes:
 *  - readById -> { schema:"artifact-registry.readById.v1", tenant: ctx.tenant, id, artifact }
 *  - search   -> { schema:"artifact-registry.search.v1", tenant: ctx.tenant, q, count, artifacts }
 *
 * Idempotent. Required gates: node --check + npm run build + npm run mcp:smoke20
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = read(p);
  if (prev === next) { console.log("No changes needed:", p); return false; }
  fs.writeFileSync(p, next);
  console.log("Patched:", p);
  return true;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
if (!exists(serverPath)) throw new Error("Missing: " + serverPath);

let src = read(serverPath);

// Guard: we must be operating on the authoritative server shape
if (!src.includes("function readRegistryFile(tenant)")) {
  throw new Error("Expected helper missing: readRegistryFile(tenant). Unsafe to continue.");
}
if (!src.includes("const TOOL_REGISTRY = {")) {
  throw new Error("Expected TOOL_REGISTRY object missing. Unsafe to continue.");
}

// Helper: insert after a known entry anchor inside TOOL_REGISTRY
function insertAfterAnchor(anchorNeedle, blockToInsert) {
  const idx = src.indexOf(anchorNeedle);
  if (idx < 0) throw new Error("Anchor not found: " + anchorNeedle);
  const insertPos = idx + anchorNeedle.length;
  src = src.slice(0, insertPos) + blockToInsert + src.slice(insertPos);
}

// Don’t double-insert if already present
const already = [
  "chc.artifact_registry.readById",
  "chc.artifact_registry.search",
  "ciag.artifact_registry.readById",
  "ciag.artifact_registry.search",
  "hospitality.artifact_registry.readById",
  "hospitality.artifact_registry.search"
].every((t) => src.includes(`"${t}"`));

if (!already) {
  // Insert right after the existing shared search tool entry (stable anchor)
  const anchor = `"shared.artifact_registry.search": {`;
  const anchorIdx = src.indexOf(anchor);
  if (anchorIdx < 0) throw new Error("Anchor not found: " + anchor);

  // Find end of that entry by locating the next tool key that starts at column 5 (4 spaces + quote)
  // We will insert AFTER the shared.search entry closing "}," which precedes the next tool.
  const afterSharedSearch = (() => {
    const from = anchorIdx;
    const tail = src.slice(from);
    const m = tail.match(/\n\s*\}\s*,\n\s*"chc\.artifact_registry\.read":\s*\{/);
    if (!m) throw new Error("Expected sequence not found: shared.search -> chc.read");
    return from + (m.index ?? 0);
  })();

  const insertPos = afterSharedSearch; // position at "\n  },\n  " right before chc.read tool key
  const block = `
    "chc.artifact_registry.readById": {
      version: "1.0.0",
      description: "Read CHC artifact by id.",
      handler: async ({ args, ctx }) => {
        if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
        const reg = readRegistryFile("chc");
        const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
        return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
      }
    },

    "chc.artifact_registry.search": {
      version: "1.0.0",
      description: "Search CHC artifacts.",
      handler: async ({ args, ctx }) => {
        const q = (args && typeof args.q === "string") ? args.q : "";
        const reg = readRegistryFile("chc");
        const qq = q.trim().toLowerCase();
        const hits = qq ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq)) : reg.artifacts;
        return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
      }
    },

    "ciag.artifact_registry.readById": {
      version: "1.0.0",
      description: "Read CIAG artifact by id.",
      handler: async ({ args, ctx }) => {
        if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
        const reg = readRegistryFile("ciag");
        const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
        return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
      }
    },

    "ciag.artifact_registry.search": {
      version: "1.0.0",
      description: "Search CIAG artifacts.",
      handler: async ({ args, ctx }) => {
        const q = (args && typeof args.q === "string") ? args.q : "";
        const reg = readRegistryFile("ciag");
        const qq = q.trim().toLowerCase();
        const hits = qq ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq)) : reg.artifacts;
        return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
      }
    },

    "hospitality.artifact_registry.readById": {
      version: "1.0.0",
      description: "Read Hospitality artifact by id.",
      handler: async ({ args, ctx }) => {
        if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
        const reg = readRegistryFile("hospitality");
        const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
        return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
      }
    },

    "hospitality.artifact_registry.search": {
      version: "1.0.0",
      description: "Search Hospitality artifacts.",
      handler: async ({ args, ctx }) => {
        const q = (args && typeof args.q === "string") ? args.q : "";
        const reg = readRegistryFile("hospitality");
        const qq = q.trim().toLowerCase();
        const hits = qq ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq)) : reg.artifacts;
        return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
      }
    },

`;
  src = src.slice(0, insertPos) + "\n" + block + src.slice(insertPos);
  writeIfChanged(serverPath, src);
} else {
  console.log("No changes needed: tenant parity tools already present in server.mjs");
}

// Ensure npm script exists
const pkgPath = path.join(ROOT, "package.json");
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke20"]) {
  pkg.scripts["mcp:smoke20"] = "node scripts/mcp_smoke_phase20.mjs";
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched: package.json (added mcp:smoke20)");
} else {
  console.log("No changes needed: package.json (mcp:smoke20 present)");
}

// Gates
console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");

console.log("== Running smoke20 (required gate) ==");
run("npm run mcp:smoke20");
