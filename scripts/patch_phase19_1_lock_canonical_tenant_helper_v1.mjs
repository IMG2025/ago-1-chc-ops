#!/usr/bin/env node
/**
 * Phase 19.1 — Lock canonical tenant registry helper
 * Introduces and locks:
 *   function readTenantRegistry(tenant)
 * Replaces any prior helper usage implicitly by routing tools through this helper.
 *
 * Idempotent. Required gates: node --check + npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

if (!src.includes("function readTenantRegistry(")) {
  const anchor = src.match(/^const\s+TENANT_REGISTRY_PATHS\s*=\s*\{/m);
  if (!anchor) {
    console.error("Expected TENANT_REGISTRY_PATHS not found. Unsafe to continue.");
    process.exit(1);
  }

  const insertAt = src.indexOf(anchor[0]);

  const helper = `
/* CANONICAL TENANT REGISTRY HELPER — LOCKED */
function readTenantRegistry(tenant = "shared") {
  const fp = TENANT_REGISTRY_PATHS[tenant];
  if (!fp) throw new Error("Unknown tenant: " + tenant);

  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  return {
    schema: raw.schema || "artifact-registry.v1",
    tenant: raw.tenant || tenant,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : []
  };
}
/* /CANONICAL TENANT REGISTRY HELPER */
`;

  src = src.slice(0, insertAt) + helper + "\n" + src.slice(insertAt);
  write(serverPath, src);
  console.log("Patched:", serverPath);
} else {
  console.log("Canonical helper already present.");
}

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required gate) ==");
run("npm run build");
