#!/usr/bin/env node
/**
 * Phase 19 fix — tenant registry file mapping
 * Ensures:
 *  - chc.artifact_registry.read reads data/artifacts.chc.json
 *  - ciag.artifact_registry.read reads data/artifacts.ciag.json
 *  - hospitality.artifact_registry.read reads data/artifacts.hospitality.json
 *  - No filtering that would drop TENANT-SEED-* markers
 *
 * Idempotent. Required gates: node --check + npm run build
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

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

// Helper to replace a TOOL_REGISTRY entry block by name
function replaceToolEntry(toolName, replacementBlock) {
  const re = new RegExp(`(["']${toolName.replace(/\./g, "\\.")}["']\\s*:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\}\\s*,?)`, "m");
  if (!re.test(src)) {
    console.error("Could not find TOOL_REGISTRY entry:", toolName);
    process.exit(1);
  }
  src = src.replace(re, (_, open, _body, close) => `${open}\n${replacementBlock}\n${close}`);
}

// Ensure we have stable path consts (insert once near top-level ROOT/PORT block)
if (!src.includes("const TENANT_REGISTRY_PATHS")) {
  // Anchor after a line that defines PORT (present in authoritative server)
  const portAnchor = src.match(/^const\s+PORT\s*=.*;$/m);
  if (!portAnchor) {
    console.error("Anchor not found: const PORT = ...;");
    process.exit(1);
  }
  const idx = src.indexOf(portAnchor[0]) + portAnchor[0].length;
  const insert = `

const TENANT_REGISTRY_PATHS = {
  shared: path.join(ROOT, "data", "artifacts.shared.json"),
  chc: path.join(ROOT, "data", "artifacts.chc.json"),
  ciag: path.join(ROOT, "data", "artifacts.ciag.json"),
  hospitality: path.join(ROOT, "data", "artifacts.hospitality.json")
};

function readTenantRegistry(tenant) {
  const t = tenant || "shared";
  const fp = TENANT_REGISTRY_PATHS[t];
  if (!fp) throw new Error("Unknown tenant: " + t);
  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  return {
    schema: raw.schema || "artifact-registry.v1",
    tenant: raw.tenant || t,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : []
  };
}
`;
  src = src.slice(0, idx) + insert + src.slice(idx);
}

// Now hard-rewrite the three tenant read tools to use readTenantRegistry()
replaceToolEntry(
  "chc.artifact_registry.read",
  `  description: "Return the CHC tenant artifact registry.",
  handler: async ({ ctx }) => {
    const data = readTenantRegistry("chc");
    return data;
  }`
);

replaceToolEntry(
  "ciag.artifact_registry.read",
  `  description: "Return the CIAG tenant artifact registry.",
  handler: async ({ ctx }) => {
    const data = readTenantRegistry("ciag");
    return data;
  }`
);

replaceToolEntry(
  "hospitality.artifact_registry.read",
  `  description: "Return the Hospitality tenant artifact registry.",
  handler: async ({ ctx }) => {
    const data = readTenantRegistry("hospitality");
    return data;
  }`
);

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
