#!/usr/bin/env node
/**
 * Phase 18A — Add per-tenant artifact registry tools (stubs)
 * - Adds chc./ciag./hospitality. artifact registry read tools
 * - Tool behavior: currently returns SAME shared artifacts file, but stamped with tenant
 *   (this is deliberate bootstrap; later each tenant gets its own backing store)
 *
 * Idempotent via full-file replacement of server.mjs (authoritative).
 * Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

const src = fs.readFileSync(serverPath, "utf8");

// Guardrail: refuse if Phase 17 baseline not present
if (!src.includes('schema: "mcp.capabilities.v1"') || !src.includes("NAMESPACE_ALLOWLIST_BY_TENANT")) {
  console.error("Phase 17 baseline not detected in server.mjs — refusing to patch.");
  process.exit(1);
}

// Replace TOOL_REGISTRY block by injecting tenant tools, leaving rest intact.
// We do a deterministic replace on the exact marker line "const TOOL_REGISTRY = Object.freeze({"
const marker = "const TOOL_REGISTRY = Object.freeze({";
const idx = src.indexOf(marker);
if (idx < 0) {
  console.error("Marker not found:", marker);
  process.exit(1);
}

// Find end of TOOL_REGISTRY object (the matching '});' after marker). We'll use a conservative search.
const endNeedle = "});\n\nfunction listTools()";
const endIdx = src.indexOf(endNeedle, idx);
if (endIdx < 0) {
  console.error("Could not locate TOOL_REGISTRY end anchor.");
  process.exit(1);
}

const pre = src.slice(0, idx);
const post = src.slice(endIdx);

const registry = `const TOOL_REGISTRY = Object.freeze({
  "shared.artifact_registry.read": Object.freeze({
    version: "1.0.0",
    description: "Return the shared artifact registry.",
    argsSchema: { type: "object", additionalProperties: true, description: "No args required." },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ ctx }) => {
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  }),

  "shared.artifact_registry.readById": Object.freeze({
    version: "1.0.0",
    description: "Read artifact by id.",
    argsSchema: { type: "object", additionalProperties: true, required: ["id"], properties: { id: { type: "string" } } },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ args, ctx }) => {
      if (!args?.id) {
        const e = new Error("Missing args.id");
        e.httpStatus = 400;
        throw e;
      }
      const data = loadArtifacts();
      const artifact = (data.artifacts || []).find(a => a.id === args.id) || null;
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        id: args.id,
        artifact
      };
    }
  }),

  "shared.artifact_registry.search": Object.freeze({
    version: "1.0.0",
    description: "Search artifacts.",
    argsSchema: { type: "object", additionalProperties: true, properties: { q: { type: "string" } } },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = loadArtifacts();
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
  }),

  // ===== Phase 18: per-tenant stubs (bootstrap) =====
  "chc.artifact_registry.read": Object.freeze({
    version: "1.0.0",
    description: "Return the CHC tenant artifact registry (bootstrap stub).",
    argsSchema: { type: "object", additionalProperties: true, description: "No args required." },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ ctx }) => {
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.v1",
        tenant: "chc",
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  }),

  "ciag.artifact_registry.read": Object.freeze({
    version: "1.0.0",
    description: "Return the CIAG tenant artifact registry (bootstrap stub).",
    argsSchema: { type: "object", additionalProperties: true, description: "No args required." },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ ctx }) => {
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.v1",
        tenant: "ciag",
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  }),

  "hospitality.artifact_registry.read": Object.freeze({
    version: "1.0.0",
    description: "Return the Hospitality tenant artifact registry (bootstrap stub).",
    argsSchema: { type: "object", additionalProperties: true, description: "No args required." },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ ctx }) => {
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.v1",
        tenant: "hospitality",
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  })
});
`;

const next = pre + registry + "\n\n" + post.replace(endNeedle, endNeedle);

fs.writeFileSync(serverPath, next);
console.log("Patched:", serverPath);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
