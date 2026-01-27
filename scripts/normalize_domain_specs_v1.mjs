#!/usr/bin/env node
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
    if (!Array.isArray(out[t])) out[t] = [`${domainId}:${t === "ANALYZE" ? "analyze" : t.toLowerCase()}`];
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
  catch (e) { throw new Error(`Invalid JSON: ${file}: ${e?.message ?? e}`); }

  if (!isPlainObject(spec)) throw new Error(`Spec must be an object: ${file}`);
  const domainId = typeof spec.domain_id === "string" ? spec.domain_id : path.basename(file).replace(/\.domain\.json$/, "");

  spec.domain_id = domainId;
  spec.supported_task_types = canonicalizeSupportedTaskTypes(spec.supported_task_types);
  spec.scopes = canonicalizeScopes(spec.scopes, domainId, spec.supported_task_types);

  // meta bookkeeping (non-authoritative)
  if (!isPlainObject(spec.meta)) spec.meta = {};
  spec.meta.updated_by = "scripts/normalize_domain_specs_v1.mjs";
  spec.meta.updated_at = new Date().toISOString();

  const normalized = stableTopLevel(spec);
  const next = JSON.stringify(normalized, null, 2) + "\n";
  if (next !== raw) {
    fs.writeFileSync(file, next);
    changed++;
  }
}

console.log(`OK: normalized domain specs (${changed} file(s) changed)`);
