#!/usr/bin/env node
/**
 * Phase 9C — Lock Tool Registry
 *
 * - Enforces a single authoritative TOOL_REGISTRY
 * - Removes legacy / fallback registry logic
 * - Guarantees /tools reflects runtime truth
 *
 * Idempotent.
 * Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const SERVER = path.join(ROOT, "services/mcp-shared-server/server.mjs");

const src = fs.readFileSync(SERVER, "utf8");

const REGISTRY_BLOCK = `
// == AUTHORITATIVE TOOL REGISTRY (Phase 9 — LOCKED) ==
const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the full shared artifact registry.",
    handler: async ({ ctx }) => {
      const raw = await fs.promises.readFile(SHARED_ARTIFACTS_PATH, "utf8");
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
    version: "1.0.0",
    description: "Return a single artifact by id.",
    handler: async ({ args, ctx }) => {
      const raw = await fs.promises.readFile(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      const found = (data.artifacts || []).find(a => a.id === args.id);
      if (!found) throw new Error("Artifact not found");
      return found;
    }
  },

  "shared.artifact_registry.search": {
    version: "1.0.0",
    description: "Search artifacts by text match.",
    handler: async ({ args, ctx }) => {
      const q = (args.q || "").toLowerCase();
      const raw = await fs.promises.readFile(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      return (data.artifacts || []).filter(a =>
        JSON.stringify(a).toLowerCase().includes(q)
      );
    }
  }
};
`;

let next = src;

// 1. Remove ALL previous TOOL_REGISTRY definitions
next = next.replace(/const TOOL_REGISTRY = \\{[\\s\\S]*?\\};/g, "");

// 2. Insert authoritative registry exactly once
if (!next.includes("AUTHORITATIVE TOOL REGISTRY")) {
  next = next.replace(
    /(const SHARED_ARTIFACTS_PATH[\\s\\S]*?;)/,
    `$1\n${REGISTRY_BLOCK}`
  );
}

fs.writeFileSync(SERVER, next);
console.log("✔ Phase 9 tool registry locked");

console.log("== Running build (required) ==");
execSync("npm run build", { stdio: "inherit" });
