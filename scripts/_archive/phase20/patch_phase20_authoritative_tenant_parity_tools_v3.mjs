#!/usr/bin/env node
/**
 * Phase 20 v3 — Authoritative tenant parity tools (readById/search)
 * Safe strategy:
 *  - Insert tool entries immediately before the TOOL_REGISTRY closing "  };"
 *  - No structural guessing, no brittle anchors.
 * Idempotent.
 * Required gates: node --check + npm run build (must be last).
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

// --- Hard preflight: ensure Phase 19 helper exists (your file uses readRegistryFile) ---
if (!src.includes("function readRegistryFile(")) {
  throw new Error("Expected helper missing: readRegistryFile(). Unsafe to continue.");
}

// --- Ensure TOOL_REGISTRY exists ---
const toolRegistryStart = src.indexOf("const TOOL_REGISTRY = {");
if (toolRegistryStart < 0) throw new Error("Missing: const TOOL_REGISTRY = {");

// --- Find the TOOL_REGISTRY close seam (stable): a line that is exactly two spaces + '};'
const closeNeedle = "\n  };";
const closeIdx = src.indexOf(closeNeedle, toolRegistryStart);
if (closeIdx < 0) throw new Error("Could not find TOOL_REGISTRY closing seam: \\n  };");

// --- Determine which entries are missing (idempotent) ---
const needed = [
  "chc.artifact_registry.readById",
  "chc.artifact_registry.search",
  "ciag.artifact_registry.readById",
  "ciag.artifact_registry.search",
  "hospitality.artifact_registry.readById",
  "hospitality.artifact_registry.search"
];

const missing = needed.filter((name) => !src.includes(`"${name}"`));
if (missing.length === 0) {
  console.log("No changes needed; tenant parity tools already present.");
  console.log("== Syntax check (required gate) ==");
  run("node --check " + serverPath);
  console.log("== Running build (required gate) ==");
  run("npm run build");
  process.exit(0);
}

// --- Build insertion block (no trailing comma on last entry) ---
function mkReadById(tenant) {
  return `  "${tenant}.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read ${tenant.toUpperCase()} artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("${tenant}");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  }`;
}

function mkSearch(tenant) {
  return `  "${tenant}.artifact_registry.search": {
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
  }`;
}

const entryBlocks = [];
for (const tenant of ["chc", "ciag", "hospitality"]) {
  if (missing.includes(`${tenant}.artifact_registry.readById`)) entryBlocks.push(mkReadById(tenant));
  if (missing.includes(`${tenant}.artifact_registry.search`)) entryBlocks.push(mkSearch(tenant));
}

const insertion = "\n\n" + entryBlocks.map((b, i) => (i < entryBlocks.length - 1 ? b + ",\n" : b + "\n")).join("");

// --- Insert right before TOOL_REGISTRY close seam, and ensure there is a comma separating from prior last entry ---
const beforeClose = src.slice(0, closeIdx);
const afterClose = src.slice(closeIdx);

// If the character immediately before the close seam isn't a comma (i.e., last property had no trailing comma), add one.
let patchedBeforeClose = beforeClose;
if (!beforeClose.trimEnd().endsWith(",")) {
  // Add a comma at the very end of the last property (safe because we're right at object boundary).
  patchedBeforeClose = beforeClose + ",";
}

src = patchedBeforeClose + insertion + afterClose;

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
