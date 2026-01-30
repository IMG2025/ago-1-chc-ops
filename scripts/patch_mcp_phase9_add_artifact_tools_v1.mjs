#!/usr/bin/env node
/**
 * patch_mcp_phase9_add_artifact_tools_v1.mjs
 * Phase 9A:
 * - Add tools:
 *   - shared.artifact_registry.readById
 *   - shared.artifact_registry.search
 * - Add args/response schemas + handlers
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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

// Guard: must be Phase 8+ (has tools registry schema)
if (!src.includes('MCP_TOOLS_REGISTRY_SCHEMA') || !src.includes('const TOOL_REGISTRY')) {
  console.error("server.mjs does not look like Phase 8+ canonical. Aborting to avoid corruption.");
  process.exit(1);
}

// Insert helper functions (artifact load + normalize query) if missing
if (!src.includes("function loadSharedArtifacts()")) {
  const anchor = "function handleToolCall";
  const idx = src.indexOf(anchor);
  if (idx < 0) {
    console.error("Anchor not found:", anchor);
    process.exit(1);
  }

  const helperBlock = `function loadSharedArtifacts() {
  const data = readJson(SHARED_ARTIFACTS_PATH);
  const artifacts = Array.isArray(data?.artifacts) ? data.artifacts : [];
  return { raw: data, artifacts };
}

function norm(s) {
  return String(s || "").toLowerCase().trim();
}

`;
  src = src.slice(0, idx) + helperBlock + src.slice(idx);
}

// Add tools to TOOL_REGISTRY if missing.
// We patch by inserting new entries right before the closing `};` of TOOL_REGISTRY.
if (!src.includes('"shared.artifact_registry.readById"')) {
  const regCloseIdx = src.indexOf("};", src.indexOf("const TOOL_REGISTRY"));
  if (regCloseIdx < 0) {
    console.error("Could not locate TOOL_REGISTRY closing `};`.");
    process.exit(1);
  }

  // Insert right before `};` (after existing tools)
  const insertPos = regCloseIdx;

  const newEntries = `,

  "shared.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read one artifact by id from the shared artifact registry.",
    argsSchema: {
      type: "object",
      required: ["id"],
      additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 }
      }
    },
    responseSchema: {
      type: "object",
      required: ["schema", "tenant", "generatedAt", "artifact"],
      properties: {
        schema: { type: "string" },
        tenant: { type: "string" },
        generatedAt: { type: "string" },
        artifact: { type: "object" }
      }
    },
    handler: async ({ args, ctx }) => {
      const { artifacts } = loadSharedArtifacts();
      const id = String(args?.id || "").trim();
      const found = artifacts.find((a) => String(a?.id || "") === id);
      if (!found) {
        const err = new Error("Artifact not found");
        // Let caller map to NOT_FOUND
        err.code = "NOT_FOUND";
        err.details = { id };
        throw err;
      }
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifact: found
      };
    }
  },

  "shared.artifact_registry.search": {
    version: "1.0.0",
    description: "Search artifacts in the shared registry (simple contains match).",
    argsSchema: {
      type: "object",
      required: ["query"],
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 1 }
      }
    },
    responseSchema: {
      type: "object",
      required: ["schema", "tenant", "generatedAt", "query", "matches"],
      properties: {
        schema: { type: "string" },
        tenant: { type: "string" },
        generatedAt: { type: "string" },
        query: { type: "string" },
        matches: { type: "array" }
      }
    },
    handler: async ({ args, ctx }) => {
      const { artifacts } = loadSharedArtifacts();
      const q = norm(args?.query);
      const matches = artifacts.filter((a) => {
        const hay = [
          a?.id, a?.name, a?.owner, a?.status, a?.version, a?.pathHint
        ].map(norm).join(" | ");
        return hay.includes(q);
      });
      return {
        schema: "artifact-registry.search.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        query: String(args?.query || ""),
        matches
      };
    }
  }`;

  src = src.slice(0, insertPos) + newEntries + src.slice(insertPos);
}

// Update handleToolCall to map tool handler errors with err.code === NOT_FOUND to 404.
if (!src.includes('e?.code === "NOT_FOUND"')) {
  src = src.replace(
    /\.catch\(\(e\)\s*=>\s*toolError\(res,\s*500,\s*"INTERNAL",[\s\S]*?\)\);/m,
    `.catch((e) => {
      if (e?.code === "NOT_FOUND") {
        return toolError(res, 404, "NOT_FOUND", e?.message || "Not found", ctx.traceId, e?.details);
      }
      return toolError(res, 500, "INTERNAL", e?.message || "Tool execution failed.", ctx.traceId);
    });`
  );
}

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required) ==");
run("npm run build");
