#!/usr/bin/env node
/**
 * Phase 20 v3 — Tenant parity tools: readById + search for chc/ciag/hospitality.
 * Goals:
 *  - Add: chc.artifact_registry.readById, chc.artifact_registry.search
 *  - Add: ciag.artifact_registry.readById, ciag.artifact_registry.search
 *  - Add: hospitality.artifact_registry.readById, hospitality.artifact_registry.search
 *  - No corruption: do NOT rewrite TOOL_REGISTRY; insert a block once via a marker.
 *
 * Idempotent. Required gates: node --check + npm run build.
 * Script ends with npm run build (per rule).
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
if (!fs.existsSync(serverPath)) throw new Error("Missing: " + serverPath);

let src = read(serverPath);

const MARKER = "PHASE20_TENANT_PARITY_TOOLS_V3";
if (src.includes(MARKER)) {
  console.log("Already present:", MARKER);
  console.log("== Syntax check (required gate) ==");
  run("node --check " + serverPath);
  console.log("== Running build (required gate) ==");
  run("npm run build");
  process.exit(0);
}

// Sanity: required helper must exist
if (!src.includes("function readRegistryFile(")) {
  throw new Error("Expected helper missing: readRegistryFile(). Unsafe to continue.");
}
if (!src.includes("const TOOL_REGISTRY")) {
  throw new Error("Expected TOOL_REGISTRY not found. Unsafe to continue.");
}

// Insert before the TOOL_REGISTRY closing `};` (authoritative end)
const endRe = /\n\s*\};\s*\n\s*\n\s*function toolsPayload\(\)/m;
const m = src.match(endRe);
if (!m) throw new Error("Could not find TOOL_REGISTRY end anchor (before toolsPayload). Unsafe to continue.");

const insertion = `
  ,
  // ${MARKER}
  "chc.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read CHC tenant artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("chc");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "chc.artifact_registry.search": {
    version: "1.0.0",
    description: "Search CHC tenant artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("chc");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },

  "ciag.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read CIAG tenant artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("ciag");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "ciag.artifact_registry.search": {
    version: "1.0.0",
    description: "Search CIAG tenant artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("ciag");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },

  "hospitality.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read Hospitality tenant artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("hospitality");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "hospitality.artifact_registry.search": {
    version: "1.0.0",
    description: "Search Hospitality tenant artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("hospitality");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  }
`;

src = src.replace(endRe, insertion + "\n$&");

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
