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

// ------------------------------------------------------------
// 0) Preconditions
// ------------------------------------------------------------
const DOMAINS_DIR = "domains";
if (!exists(DOMAINS_DIR)) throw new Error("Invariant: missing /domains directory");

// ------------------------------------------------------------
// 1) Add schema file (schemas/domain.spec.schema.json)
// ------------------------------------------------------------
const SCHEMAS_DIR = "schemas";
ensureDir(SCHEMAS_DIR);

const SCHEMA_PATH = path.join(SCHEMAS_DIR, "domain.spec.schema.json");

// Schema philosophy:
// - Hard requirements: domain_id, supported_task_types, scopes
// - Strict on known fields, but we allow extension via meta.extras (object)
// - This prevents random top-level drift while preserving traceability.
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://coreholdingcorp.com/schemas/domain.spec.schema.json",
  title: "AGO-1 Domain Spec",
  type: "object",
  additionalProperties: false,
  required: ["domain_id", "supported_task_types", "scopes"],
  properties: {
    domain_id: {
      type: "string",
      pattern: "^[a-z][a-z0-9\\-]*$",
      minLength: 2,
      maxLength: 64
    },
    name: { type: "string", minLength: 1, maxLength: 128 },
    version: { type: "string", minLength: 1, maxLength: 32 },
    description: { type: "string", minLength: 1, maxLength: 2000 },

    supported_task_types: {
      type: "array",
      items: { enum: ["EXECUTE", "ANALYZE", "ESCALATE"] },
      minItems: 1,
      uniqueItems: true
    },

    scopes: {
      type: "object",
      additionalProperties: false,
      properties: {
        EXECUTE: { type: "array", items: { type: "string", minLength: 3 }, minItems: 1, uniqueItems: true },
        ANALYZE: { type: "array", items: { type: "string", minLength: 3 }, minItems: 1, uniqueItems: true },
        ESCALATE:{ type: "array", items: { type: "string", minLength: 3 }, minItems: 1, uniqueItems: true }
      },
      // We do NOT require every task type key, because some domains may intentionally not support all types.
      // But if a domain includes a task type in supported_task_types, normalize will ensure the matching scopes key exists.
      required: []
    },

    // meta is the sanctioned extension channel
    meta: {
      type: "object",
      additionalProperties: false,
      properties: {
        owner: { type: "string" },
        created_by: { type: "string" },
        updated_by: { type: "string" },
        updated_at: { type: "string" },
        extras: { type: "object", additionalProperties: true }
      },
      required: []
    }
  }
};

writeIfChanged(SCHEMA_PATH, JSON.stringify(schema, null, 2) + "\n");

// ------------------------------------------------------------
// 2) Add normalizer: scripts/normalize_domain_specs_v1.mjs
//    - Canonicalizes supported_task_types ordering
//    - Ensures scopes exist for any supported_task_types
//    - Moves unknown top-level keys into meta.extras
//    - Writes stable JSON ordering for diff hygiene
// ------------------------------------------------------------
const NORMALIZE = "scripts/normalize_domain_specs_v1.mjs";
const normalizerSrc = `#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DOMAINS_DIR = path.join(ROOT, "domains");

const CANON_TASKS = ["EXECUTE", "ANALYZE", "ESCALATE"];

function listDomainFiles() {
  if (!fs.existsSync(DOMAINS_DIR)) throw new Error("Missing /domains");
  return fs.readdirSync(DOMAINS_DIR).filter(f => f.endsWith(".domain.json")).map(f => path.join(DOMAINS_DIR, f));
}

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    if (!seen.has(v)) { seen.add(v); out.push(v); }
  }
  return out;
}

function canonicalizeSupportedTaskTypes(v) {
  const arr = Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
  const set = new Set(arr);
  const ordered = CANON_TASKS.filter(t => set.has(t));
  // If none present, default to all three (fail closed is handled by schema audit; this is a normalizer)
  return ordered.length ? ordered : [...CANON_TASKS];
}

function canonicalizeScopes(scopes, domainId, supported) {
  const out = isPlainObject(scopes) ? { ...scopes } : {};
  for (const t of supported) {
    if (!Array.isArray(out[t])) out[t] = [\`\${domainId}:\${t === "ANALYZE" ? "analyze" : t.toLowerCase()}\`];
    // stabilize: strings only, uniq, stable order (keep declared order; do not sort to avoid policy surprises)
    out[t] = uniq(out[t].filter(x => typeof x === "string" && x.length > 0));
  }
  // remove any non-canonical keys
  for (const k of Object.keys(out)) {
    if (!CANON_TASKS.includes(k)) delete out[k];
  }
  return out;
}

function stableTopLevel(spec) {
  // Move unknown keys to meta.extras (sanctioned extension channel)
  const allowed = new Set(["domain_id","name","version","description","supported_task_types","scopes","meta"]);
  const extras = {};
  for (const [k, v] of Object.entries(spec)) {
    if (!allowed.has(k)) extras[k] = v;
  }
  for (const k of Object.keys(extras)) delete spec[k];

  if (!isPlainObject(spec.meta)) spec.meta = {};
  if (!isPlainObject(spec.meta.extras)) spec.meta.extras = {};
  // Merge extras (spec meta.extras wins on conflict to avoid destructive overwrite)
  spec.meta.extras = { ...extras, ...spec.meta.extras };

  // Canonical key ordering (diff hygiene)
  const ordered = {
    domain_id: spec.domain_id,
    name: spec.name,
    version: spec.version,
    description: spec.description,
    supported_task_types: spec.supported_task_types,
    scopes: spec.scopes,
    meta: spec.meta
  };
  // Drop undefined
  for (const k of Object.keys(ordered)) {
    if (ordered[k] === undefined) delete ordered[k];
  }
  return ordered;
}

let changed = 0;
for (const file of listDomainFiles()) {
  const raw = fs.readFileSync(file, "utf8");
  let spec;
  try { spec = JSON.parse(raw); }
  catch (e) { throw new Error(\`Invalid JSON: \${file}: \${e?.message ?? e}\`); }

  if (!isPlainObject(spec)) throw new Error(\`Spec must be an object: \${file}\`);
  const domainId = typeof spec.domain_id === "string" ? spec.domain_id : path.basename(file).replace(/\\.domain\\.json$/, "");

  spec.domain_id = domainId;
  spec.supported_task_types = canonicalizeSupportedTaskTypes(spec.supported_task_types);
  spec.scopes = canonicalizeScopes(spec.scopes, domainId, spec.supported_task_types);

  // meta bookkeeping (non-authoritative)
  if (!isPlainObject(spec.meta)) spec.meta = {};
  spec.meta.updated_by = "scripts/normalize_domain_specs_v1.mjs";
  spec.meta.updated_at = new Date().toISOString();

  const normalized = stableTopLevel(spec);
  const next = JSON.stringify(normalized, null, 2) + "\\n";
  if (next !== raw) {
    fs.writeFileSync(file, next);
    changed++;
  }
}

console.log(\`OK: normalized domain specs (\${changed} file(s) changed)\`);
`;
writeIfChanged(NORMALIZE, normalizerSrc);
chmod755(NORMALIZE);

// ------------------------------------------------------------
// 3) Add schema audit script: scripts/audit_domain_spec_schema_v1.sh
//    - Uses Ajv (devDependency)
// ------------------------------------------------------------
const AUDIT = "scripts/audit_domain_spec_schema_v1.sh";
const auditSrc = `#!/usr/bin/env bash
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
      return \`\${p} \${loc} \${e.message}\`;
    });
    fail("Schema validation failed:\\n" + errs.join("\\n"));
  }
}

console.log("OK: domain specs conform to schema:", files.map(f => f.replace(/\\.domain\\.json$/, "")));
NODE

# Must end with npm run build (audit scripts included in npm test chain, but we keep the convention here)
npm run build >/dev/null
`;
writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);

// ------------------------------------------------------------
// 4) Ensure Ajv deps exist (idempotent)
// ------------------------------------------------------------
const pkgPath = "package.json";
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));

pkg.devDependencies = pkg.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {};
const needAjv = !pkg.devDependencies["ajv"];
const needFormats = !pkg.devDependencies["ajv-formats"];

if (needAjv) pkg.devDependencies["ajv"] = "^8.17.1";
if (needFormats) pkg.devDependencies["ajv-formats"] = "^3.0.1";

if (needAjv || needFormats) {
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  // Install only if we changed deps
  run("npm install");
}

// ------------------------------------------------------------
// 5) Wire audit into npm test chain (idempotent)
//    Insert after audit_domain_executor_alignment_v1.sh if present.
// ------------------------------------------------------------
const testCmd = pkg.scripts?.test;
if (typeof testCmd !== "string") throw new Error("Invariant: package.json scripts.test missing or not a string.");

let next = testCmd;
if (!next.includes("audit_domain_spec_schema_v1.sh")) {
  if (next.includes("./scripts/audit_domain_executor_alignment_v1.sh")) {
    next = next.replace(
      "./scripts/audit_domain_executor_alignment_v1.sh",
      "./scripts/audit_domain_executor_alignment_v1.sh && ./scripts/audit_domain_spec_schema_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_domain_spec_schema_v1.sh";
  }

  const pkg2 = JSON.parse(read(pkgPath));
  pkg2.scripts = pkg2.scripts ?? {};
  pkg2.scripts.test = next;
  writeIfChanged(pkgPath, JSON.stringify(pkg2, null, 2) + "\n");
}

// ------------------------------------------------------------
// 6) Gates (must end with npm run build)
// ------------------------------------------------------------
run("npm test");
run("npm run build");
