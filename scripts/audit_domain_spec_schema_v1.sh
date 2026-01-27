#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Normalize first so schema audit is deterministic
node ./scripts/normalize_domain_specs_v1.mjs >/dev/null

node - <<'NODE'
import fs from "node:fs";
import path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const schemaPath = path.join("schemas", "domain.spec.schema.json");
if (!fs.existsSync(schemaPath)) fail("Missing schema: " + schemaPath);

let schema;
try { schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")); }
catch (e) { fail("Invalid schema JSON: " + (e?.message ?? e)); }

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);

const domainsDir = "domains";
const files = fs.readdirSync(domainsDir).filter(f => f.endsWith(".domain.json"));
if (files.length === 0) fail("No domain spec files found in /domains");

for (const f of files) {
  const p = path.join(domainsDir, f);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { fail("Invalid JSON: " + p + ": " + (e?.message ?? e)); }

  const ok = validate(doc);
  if (!ok) {
    const errs = (validate.errors ?? []).map(e => {
      const loc = e.instancePath || "(root)";
      return `${p} ${loc} ${e.message}`;
    });
    fail("Schema validation failed:\n" + errs.join("\n"));
  }
}

console.log("OK: domain specs conform to schema:", files.map(f => f.replace(/\.domain\.json$/, "")));
NODE

# Must end with npm run build (audit scripts included in npm test chain, but we keep the convention here)
npm run build >/dev/null
