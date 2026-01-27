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

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const schemaPath = path.join("schemas", "domain.spec.schema.json");
if (!fs.existsSync(schemaPath)) fail(`Missing schema: ${schemaPath}`);

let schema;
try { schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); }
catch (e) { fail(`Invalid JSON schema: ${schemaPath}`); }

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const domainsDir = "domains";
if (!fs.existsSync(domainsDir)) fail("Missing domains/ directory.");

const files = fs.readdirSync(domainsDir).filter(f => f.endsWith(".domain.json")).sort();
if (files.length === 0) fail("No domain spec files found in domains/.");

const bad = [];
for (const f of files) {
  const p = path.join(domainsDir, f);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { bad.push({ file: f, error: "INVALID_JSON" }); continue; }

  const ok = validate(doc);
  if (!ok) {
    bad.push({ file: f, error: "SCHEMA_VIOLATION", details: validate.errors });
  }
}

if (bad.length) {
  console.error("FAIL: domain specs do not conform to schema:");
  for (const b of bad) {
    console.error("-", b.file, b.error);
    if (b.details) console.error(JSON.stringify(b.details, null, 2));
  }
  process.exit(1);
}

console.log("OK: domain specs conform to schema:", files.map(f => f.replace(".domain.json","")));
NODE
