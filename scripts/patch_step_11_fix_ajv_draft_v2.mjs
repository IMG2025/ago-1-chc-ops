#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCHEMA_PATH = "schemas/domain.spec.schema.json";
const AUDIT_PATH = "scripts/audit_domain_spec_schema_v1.sh";

if (!exists(SCHEMA_PATH)) throw new Error(`Missing: ${SCHEMA_PATH}`);
if (!exists(AUDIT_PATH)) throw new Error(`Missing: ${AUDIT_PATH}`);

// ------------------------------------------------------------
// 1) Patch schema: switch to draft-07 (Ajv meta available by default)
// ------------------------------------------------------------
let schemaTxt = read(SCHEMA_PATH);
let schema;
try { schema = JSON.parse(schemaTxt); }
catch (e) { throw new Error(`Invariant: invalid JSON in ${SCHEMA_PATH}`); }

// Idempotent: only patch if currently 2020-12
if (schema.$schema === "https://json-schema.org/draft/2020-12/schema") {
  schema.$schema = "http://json-schema.org/draft-07/schema#";
  // $id is fine, but not required; keep if present.
  writeIfChanged(SCHEMA_PATH, JSON.stringify(schema, null, 2) + "\n");
  console.log("OK: schema switched to draft-07 for Ajv compatibility.");
} else {
  console.log("OK: schema already draft-07 (or non-2020-12).");
}

// ------------------------------------------------------------
// 2) Patch audit script: ensure Ajv is configured sanely for draft-07
//    (Ajv v8 supports draft-07 out of the box; we keep strict=false.)
// ------------------------------------------------------------
let audit = read(AUDIT_PATH);

// Minimal, safe patch: ensure Ajv({strict:false, allErrors:true}) remains, no meta-schema preloading required.
// We mainly want to avoid any future drift if we later changed draft in code.
if (!audit.includes('new Ajv({ allErrors: true, strict: false')) {
  audit = audit.replace(
    /const ajv = new Ajv\(\{[\s\S]*?\}\);/m,
    'const ajv = new Ajv({ allErrors: true, strict: false });'
  );
  writeIfChanged(AUDIT_PATH, audit);
  console.log("OK: normalized Ajv constructor in audit script.");
} else {
  console.log("OK: audit script Ajv constructor already canonical.");
}

// ------------------------------------------------------------
// 3) Gates (must end with npm run build)
// ------------------------------------------------------------
run("npm test");
run("npm run build");
