#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCHEMAS_DIR = "schemas";
ensureDir(SCHEMAS_DIR);

const SCHEMA_PATH = path.join(SCHEMAS_DIR, "executor.spec.schema.json");
const AUDIT_PATH = "scripts/audit_executor_spec_schema_v1.sh";
const PKG_PATH = "package.json";

if (!exists(PKG_PATH)) throw new Error("Missing: package.json");

// ------------------------------------------------------------
// 1) Lock executor spec schema (draft-07 for Ajv Termux compatibility)
//    NOTE: functions (validate_inputs/execute) are asserted in audit code (not JSON schema).
// ------------------------------------------------------------
const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://coreholdingcorp.com/schemas/executor.spec.schema.json",
  title: "AGO-1 Executor Spec (canonical)",
  type: "object",
  additionalProperties: true,
  required: ["domain_id", "executor_id", "supported_task_types", "required_scopes"],
  properties: {
    domain_id: { type: "string", minLength: 1 },
    executor_id: { type: "string", minLength: 1 },
    supported_task_types: {
      type: "array",
      minItems: 1,
      items: { enum: ["EXECUTE", "ANALYZE", "ESCALATE"] },
      uniqueItems: true
    },
    required_scopes: {
      type: "object",
      additionalProperties: false,
      properties: {
        EXECUTE: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        ANALYZE: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        ESCALATE: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 }
      }
    },
    domain_action_scopes: {
      type: "object",
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        properties: {
          EXECUTE: { type: "array", items: { type: "string", minLength: 1 } },
          ANALYZE: { type: "array", items: { type: "string", minLength: 1 } },
          ESCALATE: { type: "array", items: { type: "string", minLength: 1 } }
        }
      }
    }
  }
};

writeIfChanged(SCHEMA_PATH, JSON.stringify(schema, null, 2) + "\n");
console.log(`OK: wrote ${SCHEMA_PATH}`);

// ------------------------------------------------------------
// 2) Read-only audit: validate mounted executor specs against schema + assert required functions exist.
//    - build first
//    - import dist/index.js mount + dist/registry.js DomainRegistry
//    - validate each executor spec
// ------------------------------------------------------------
const auditSrc = `#!/usr/bin/env bash
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
if (!fs.existsSync(schemaPath)) fail(\`Missing schema: \${schemaPath}\`);

let schema;
try { schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); }
catch (e) { fail(\`Invalid JSON schema: \${schemaPath}\`); }

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
`;

writeIfChanged(AUDIT_PATH, auditSrc);
chmod755(AUDIT_PATH);
console.log(`OK: wrote ${AUDIT_PATH}`);

// ------------------------------------------------------------
// 3) Wire audit into npm test chain (idempotent)
// ------------------------------------------------------------
const pkg = JSON.parse(read(PKG_PATH));
const testCmd = pkg.scripts?.test;
if (typeof testCmd !== "string") throw new Error("Invariant: package.json scripts.test missing or not a string.");

if (!testCmd.includes("./scripts/audit_executor_spec_schema_v1.sh")) {
  let next = testCmd;

  // Prefer to run after canonical mount + domain↔executor alignment audits if present
  if (next.includes("./scripts/audit_domain_spec_schema_v1.sh")) {
    next = next.replace(
      "./scripts/audit_domain_spec_schema_v1.sh",
      "./scripts/audit_domain_spec_schema_v1.sh && ./scripts/audit_executor_spec_schema_v1.sh"
    );
  } else if (next.includes("./scripts/audit_domain_executor_alignment_v1.sh")) {
    next = next.replace(
      "./scripts/audit_domain_executor_alignment_v1.sh",
      "./scripts/audit_domain_executor_alignment_v1.sh && ./scripts/audit_executor_spec_schema_v1.sh"
    );
  } else if (next.includes("./scripts/audit_mount_canonical_specs.sh")) {
    next = next.replace(
      "./scripts/audit_mount_canonical_specs.sh",
      "./scripts/audit_mount_canonical_specs.sh && ./scripts/audit_executor_spec_schema_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_executor_spec_schema_v1.sh";
  }

  pkg.scripts.test = next;
  writeIfChanged(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: wired executor spec schema audit into npm test");
} else {
  console.log("OK: executor spec schema audit already wired into npm test");
}

// ------------------------------------------------------------
// 4) Gates (must end with npm run build)
// ------------------------------------------------------------
run("npm test");
run("npm run build");
