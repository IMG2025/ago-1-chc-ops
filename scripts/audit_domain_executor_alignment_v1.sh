#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Build first (dist/* is the source of truth for audits)
npm run build >/dev/null

node - <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains();
if (!Array.isArray(domains) || domains.length === 0) fail("No mounted domains discovered.");

for (const domainId of domains) {
  const specPath = path.join("domains", `${domainId}.domain.json`);
  if (!fs.existsSync(specPath)) fail(`Missing domain spec file: ${specPath}`);

  let spec;
  try { spec = JSON.parse(fs.readFileSync(specPath, "utf8")); }
  catch (e) { fail(`Invalid JSON in ${specPath}: ${e?.message ?? e}`); }

  const exec = registry.get(domainId);
  if (!exec) fail(`Mounted domain missing from registry.get(): ${domainId}`);

  const required = exec.required_scopes ?? {};
  const scopes = spec.scopes ?? {};

  // For each task type required by executor, ensure the primary required scope is present in spec.scopes[taskType]
  for (const taskType of ["EXECUTE", "ANALYZE", "ESCALATE"]) {
    const execScopes = required[taskType];
    if (!execScopes || !Array.isArray(execScopes) || execScopes.length === 0) continue;

    const primary = execScopes[0];
    const specScopes = scopes[taskType];

    if (!specScopes || !Array.isArray(specScopes)) {
      fail(`Domain ${domainId}: spec.scopes.${taskType} missing/invalid; expected to include ${primary}`);
    }
    if (!specScopes.includes(primary)) {
      fail(`Domain ${domainId}: executor requires ${primary} for ${taskType}, but spec.scopes.${taskType} does not include it`);
    }
  }
}

console.log("OK: domain specs align with executor required_scopes for all mounted domains:", domains);
NODE
