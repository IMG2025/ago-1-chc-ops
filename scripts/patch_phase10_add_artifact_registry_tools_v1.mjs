#!/usr/bin/env node
/**
 * Phase 10A — Add shared artifact registry tools to canonical mcp-shared-server
 * - Adds: shared.artifact_registry.readById, shared.artifact_registry.search
 * - Keeps: read
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
  } else {
    console.log("No changes needed; already applied.");
  }
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

// Anchor: TOOL_REGISTRY object literal start
const regStart = src.indexOf("const TOOL_REGISTRY = {");
if (regStart < 0) {
  console.error("Anchor not found: const TOOL_REGISTRY = {");
  process.exit(1);
}
const regEnd = src.indexOf("};", regStart);
if (regEnd < 0) {
  console.error("Anchor not found: end of TOOL_REGISTRY (};)");
  process.exit(1);
}

const existing = src.slice(regStart, regEnd);

if (!existing.includes('"shared.artifact_registry.readById"')) {
  const inject = `
  ,
  "shared.artifact_registry.readById": {
    description: "Read a single artifact by id",
    handler: async ({ args, ctx }) => {
      const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      const id = args?.id;
      if (!id || typeof id !== "string") {
        throw new Error("Missing args.id (string)");
      }
      const artifact = (data.artifacts || []).find(a => a && a.id === id) || null;
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        id,
        artifact
      };
    }
  }
`;
  // Insert right before the closing `}` of TOOL_REGISTRY object
  const closeBraceIdx = src.lastIndexOf("}", regEnd);
  src = src.slice(0, closeBraceIdx) + inject + src.slice(closeBraceIdx);
}

if (!src.includes('"shared.artifact_registry.search"')) {
  const inject = `
  ,
  "shared.artifact_registry.search": {
    description: "Search artifacts by substring match on id/name/owner/status",
    handler: async ({ args, ctx }) => {
      const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      const q = (args?.q && typeof args.q === "string") ? args.q.trim().toLowerCase() : "";
      const artifacts = (data.artifacts || []);
      const hits = !q ? artifacts : artifacts.filter(a => {
        const hay = [
          a?.id, a?.name, a?.owner, a?.status, a?.version, a?.pathHint
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
      return {
        schema: "artifact-registry.search.v1",
        tenant: ctx.tenant,
        q,
        count: hits.length,
        artifacts: hits
      };
    }
  }
`;
  const closeBraceIdx = src.lastIndexOf("}", src.indexOf("const TOOL_REGISTRY = {"));
  src = src.slice(0, closeBraceIdx) + inject + src.slice(closeBraceIdx);
}

// Update /debug registryKeys still fine; /tools enumerates TOOL_REGISTRY so it will pick these up automatically.
writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required) ==");
run("npm run build");
