#!/usr/bin/env node
/**
 * Phase 10 FIX — Normalize TOOL_REGISTRY (authoritative rewrite)
 * - Rewrites TOOL_REGISTRY as a single canonical object
 * - Includes: read, readById, search
 * - Eliminates comma/brace drift permanently
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

const src = fs.readFileSync(serverPath, "utf8");

const REGEX = /const\s+TOOL_REGISTRY\s*=\s*\{[\s\S]*?\};/m;
if (!REGEX.test(src)) {
  console.error("TOOL_REGISTRY block not found.");
  process.exit(1);
}

const registryBlock = `
const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    description: "Return the shared artifact registry (read-only bootstrap tool).",
    handler: async ({ ctx }) => {
      const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  },

  "shared.artifact_registry.readById": {
    description: "Read a single artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args?.id || typeof args.id !== "string") {
        throw new Error("Missing args.id (string)");
      }
      const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      const artifact = (data.artifacts || []).find(a => a?.id === args.id) || null;
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        id: args.id,
        artifact
      };
    }
  },

  "shared.artifact_registry.search": {
    description: "Search artifacts by substring match.",
    handler: async ({ args, ctx }) => {
      const q = typeof args?.q === "string" ? args.q.toLowerCase() : "";
      const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      const artifacts = data.artifacts || [];
      const hits = !q
        ? artifacts
        : artifacts.filter(a =>
            Object.values(a || {})
              .join(" ")
              .toLowerCase()
              .includes(q)
          );
      return {
        schema: "artifact-registry.search.v1",
        tenant: ctx.tenant,
        q,
        count: hits.length,
        artifacts: hits
      };
    }
  }
};
`.trim();

const next = src.replace(REGEX, registryBlock);

fs.writeFileSync(serverPath, next);
console.log("Patched:", serverPath);

console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required) ==");
run("npm run build");
