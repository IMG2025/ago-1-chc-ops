#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function exists(p) { return fs.existsSync(p); }
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const DOMAINS_DIR = "domains";
ensureDir(DOMAINS_DIR);

const TARGET = path.join(DOMAINS_DIR, "ciag.domain.json");
if (exists(TARGET)) {
  console.log("OK: domains/ciag.domain.json already exists (no changes).");
  run("npm test");
  run("npm run build");
  process.exit(0);
}

// Prefer an existing canonical template in this repo.
// chc is new; hospitality is older. Either is acceptable as a schema template.
const candidates = [
  path.join(DOMAINS_DIR, "chc.domain.json"),
  path.join(DOMAINS_DIR, "hospitality.domain.json"),
];

const templatePath = candidates.find(exists);
if (!templatePath) {
  throw new Error(
    "Invariant: cannot create domains/ciag.domain.json because no template domain spec exists.\n" +
    "Expected one of:\n" +
    "  domains/chc.domain.json\n" +
    "  domains/hospitality.domain.json\n"
  );
}

let tmpl;
try {
  tmpl = JSON.parse(read(templatePath));
} catch (e) {
  throw new Error(`Invariant: template domain spec is not valid JSON: ${templatePath}`);
}

// We preserve the template schema and only swap identity + scopes.
// This keeps us aligned with any schema expectations elsewhere in the repo.
tmpl.domain_id = "ciag";
if (typeof tmpl.name === "string") tmpl.name = "CIAG";
if (typeof tmpl.version === "string") tmpl.version = tmpl.version || "v1";

// Ensure supported task types exist and are canonical.
tmpl.supported_task_types = ["EXECUTE", "ANALYZE", "ESCALATE"];

// Ensure scopes exist and are canonical for CIAG.
tmpl.scopes = tmpl.scopes && typeof tmpl.scopes === "object" ? tmpl.scopes : {};
tmpl.scopes.EXECUTE = ["ciag:execute"];
tmpl.scopes.ANALYZE = ["ciag:analyze"];
tmpl.scopes.ESCALATE = ["ciag:escalate"];

// Optional: remove any domain-specific fields that hardcode other domains.
// We do this conservatively: if a string contains "hospitality:" or "chc:" we rewrite to "ciag:".
function rewritePrefixes(x) {
  if (typeof x === "string") {
    return x.replaceAll("hospitality:", "ciag:").replaceAll("chc:", "ciag:");
  }
  if (Array.isArray(x)) return x.map(rewritePrefixes);
  if (x && typeof x === "object") {
    const out = {};
    for (const [k, v] of Object.entries(x)) out[k] = rewritePrefixes(v);
    return out;
  }
  return x;
}
tmpl = rewritePrefixes(tmpl);

writeIfChanged(TARGET, JSON.stringify(tmpl, null, 2) + "\n");
console.log(`OK: created ${TARGET} from template ${templatePath}`);

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
