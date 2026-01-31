#!/usr/bin/env node
/**
 * Phase 20 v3.1 — Authoritative tenant parity tools (SAFE)
 * Adds tenant readById/search via Object.assign (no syntax risk)
 *
 * Idempotent
 * Required gates:
 *  - node --check
 *  - npm run build
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const FILE = "services/mcp-shared-server/server.mjs";
let src = fs.readFileSync(FILE, "utf8");

const MARKER = "PHASE20_V3_1_TENANT_PARITY";
if (src.includes(MARKER)) {
  console.log("Already applied:", MARKER);
  run(`node --check ${FILE}`);
  run("npm run build");
  process.exit(0);
}

if (!src.includes("const TOOL_REGISTRY")) {
  throw new Error("TOOL_REGISTRY not found — abort");
}

const PATCH = `

/* ${MARKER} */
Object.assign(TOOL_REGISTRY, {
  "chc.artifact_registry.readById": {
    version: "1.0.0",
    handler: async ({ args, ctx }) => {
      const reg = readRegistryFile("chc");
      const artifact = reg.artifacts.find(a => a?.id === args?.id) || null;
      return { id: args.id, artifact };
    }
  },
  "chc.artifact_registry.search": {
    version: "1.0.0",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const reg = readRegistryFile("chc");
      const hits = q ? reg.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q)) : reg.artifacts;
      return { q, count: hits.length, artifacts: hits };
    }
  },

  "ciag.artifact_registry.readById": {
    version: "1.0.0",
    handler: async ({ args }) => {
      const reg = readRegistryFile("ciag");
      const artifact = reg.artifacts.find(a => a?.id === args?.id) || null;
      return { id: args.id, artifact };
    }
  },
  "ciag.artifact_registry.search": {
    version: "1.0.0",
    handler: async ({ args }) => {
      const q = (args?.q || "").toLowerCase();
      const reg = readRegistryFile("ciag");
      const hits = q ? reg.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q)) : reg.artifacts;
      return { q, count: hits.length, artifacts: hits };
    }
  },

  "hospitality.artifact_registry.readById": {
    version: "1.0.0",
    handler: async ({ args }) => {
      const reg = readRegistryFile("hospitality");
      const artifact = reg.artifacts.find(a => a?.id === args?.id) || null;
      return { id: args.id, artifact };
    }
  },
  "hospitality.artifact_registry.search": {
    version: "1.0.0",
    handler: async ({ args }) => {
      const q = (args?.q || "").toLowerCase();
      const reg = readRegistryFile("hospitality");
      const hits = q ? reg.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q)) : reg.artifacts;
      return { q, count: hits.length, artifacts: hits };
    }
  }
});
`;

fs.writeFileSync(FILE, src + PATCH);
console.log("Patched:", FILE);

run(`node --check ${FILE}`);
run("npm run build");
