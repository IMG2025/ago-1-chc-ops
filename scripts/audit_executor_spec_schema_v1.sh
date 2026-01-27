#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Build first; dist is source of truth for runtime imports
npm run build >/dev/null

node - <<'NODE'
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const schemaPath = path.join("schemas", "executor.spec.schema.json");
if (!fs.existsSync(schemaPath)) fail(`Missing schema: ${schemaPath}`);

let schema;
try { schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); }
catch (e) { fail(`Invalid JSON schema: ${schemaPath}`); }

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains();
if (!Array.isArray(domains) || domains.length === 0) fail("No mounted domains discovered.");

const bad = [];
for (const domainId of domains) {
  const exec = registry.get(domainId);
  if (!exec) { bad.push({ domainId, error: "MISSING_EXECUTOR" }); continue; }

  // Assert function requirements (JSON schema can’t validate functions)
  if (typeof exec.validate_inputs !== "function") {
    bad.push({ domainId, error: "MISSING_VALIDATE_INPUTS_FN" });
  }
  if (typeof exec.execute !== "function") {
    bad.push({ domainId, error: "MISSING_EXECUTE_FN" });
  }

  // Validate JSON-compatible subset against schema
  const jsonable = {
    domain_id: exec.domain_id,
    executor_id: exec.executor_id,
    supported_task_types: exec.supported_task_types,
    required_scopes: exec.required_scopes,
    domain_action_scopes: exec.domain_action_scopes,
  };

  const ok = validate(jsonable);
  if (!ok) {
    bad.push({ domainId, error: "SCHEMA_VIOLATION", details: validate.errors });
  }
}

if (bad.length) {
  console.error("FAIL: executor specs do not conform to schema:");
  for (const b of bad) {
    console.error("-", b.domainId, b.error);
    if (b.details) console.error(JSON.stringify(b.details, null, 2));
  }
  process.exit(1);
}

console.log("OK: executor specs conform to schema for mounted domains:", domains);
NODE
