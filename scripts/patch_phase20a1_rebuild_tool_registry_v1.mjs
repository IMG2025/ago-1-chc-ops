#!/usr/bin/env node
/**
 * Phase 20A.1 — Rebuild TOOL_REGISTRY authoritatively (tenant parity)
 * Ensures /tools + /capabilities include:
 *  - shared: read/readById/search
 *  - chc: read/readById/search
 *  - ciag: read/readById/search
 *  - hospitality: read/readById/search
 *
 * Idempotent. Required gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
if (!fs.existsSync(serverPath)) throw new Error("Missing: " + serverPath);

let src = fs.readFileSync(serverPath, "utf8");

// must already exist from phase19 fix
if (!src.includes("function readTenantRegistry(")) {
  throw new Error("Expected helper missing: readTenantRegistry(). Unsafe to continue.");
}

// Replace TOOL_REGISTRY block authoritatively
const re = /const\s+TOOL_REGISTRY\s*=\s*\{[\s\S]*?\n\};/m;
if (!re.test(src)) throw new Error("TOOL_REGISTRY block not found. Unsafe to continue.");

const replacement = `
const TOOL_REGISTRY = {
  /* ===== Shared ===== */
  "shared.artifact_registry.read": {
    description: "Read shared artifact registry",
    handler: async ({ ctx }) => readTenantRegistry("shared")
  },
  "shared.artifact_registry.readById": {
    description: "Read shared artifact by id",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = readTenantRegistry("shared");
      return data.artifacts.find(a => a.id === args.id) || null;
    }
  },
  "shared.artifact_registry.search": {
    description: "Search shared artifacts",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = readTenantRegistry("shared");
      return data.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q));
    }
  },

  /* ===== CHC ===== */
  "chc.artifact_registry.read": {
    description: "Read CHC artifact registry",
    handler: async ({ ctx }) => readTenantRegistry("chc")
  },
  "chc.artifact_registry.readById": {
    description: "Read CHC artifact by id",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = readTenantRegistry("chc");
      return data.artifacts.find(a => a.id === args.id) || null;
    }
  },
  "chc.artifact_registry.search": {
    description: "Search CHC artifacts",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = readTenantRegistry("chc");
      return data.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q));
    }
  },

  /* ===== CIAG ===== */
  "ciag.artifact_registry.read": {
    description: "Read CIAG artifact registry",
    handler: async ({ ctx }) => readTenantRegistry("ciag")
  },
  "ciag.artifact_registry.readById": {
    description: "Read CIAG artifact by id",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = readTenantRegistry("ciag");
      return data.artifacts.find(a => a.id === args.id) || null;
    }
  },
  "ciag.artifact_registry.search": {
    description: "Search CIAG artifacts",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = readTenantRegistry("ciag");
      return data.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q));
    }
  },

  /* ===== Hospitality ===== */
  "hospitality.artifact_registry.read": {
    description: "Read Hospitality artifact registry",
    handler: async ({ ctx }) => readTenantRegistry("hospitality")
  },
  "hospitality.artifact_registry.readById": {
    description: "Read Hospitality artifact by id",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = readTenantRegistry("hospitality");
      return data.artifacts.find(a => a.id === args.id) || null;
    }
  },
  "hospitality.artifact_registry.search": {
    description: "Search Hospitality artifacts",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = readTenantRegistry("hospitality");
      return data.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q));
    }
  }
};
`.trim();

const next = src.replace(re, replacement);
if (next === src) {
  console.log("No changes needed; TOOL_REGISTRY already authoritative.");
} else {
  fs.writeFileSync(serverPath, next);
  console.log("Patched:", serverPath);
}

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
