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

const TARGET = path.join(DOMAINS_DIR, "hospitality.domain.json");
if (exists(TARGET)) {
  console.log("OK: domains/hospitality.domain.json already exists (no changes).");
  run("npm test");
  run("npm run build");
  process.exit(0);
}

// Use CHC as schema template if present; else CIAG.
const candidates = [
  path.join(DOMAINS_DIR, "chc.domain.json"),
  path.join(DOMAINS_DIR, "ciag.domain.json"),
];

const templatePath = candidates.find(exists);
if (!templatePath) {
  throw new Error(
    "Invariant: cannot create domains/hospitality.domain.json because no template domain spec exists.\n" +
    "Expected one of:\n" +
    "  domains/chc.domain.json\n" +
    "  domains/ciag.domain.json\n"
  );
}

let tmpl;
try {
  tmpl = JSON.parse(read(templatePath));
} catch {
  throw new Error(`Invariant: template domain spec is not valid JSON: ${templatePath}`);
}

// Normalize identity
tmpl.domain_id = "hospitality";
if (typeof tmpl.name === "string") tmpl.name = "Hospitality";
if (typeof tmpl.version === "string") tmpl.version = tmpl.version || "v1";

// Canonical task types + scopes
tmpl.supported_task_types = ["EXECUTE", "ANALYZE", "ESCALATE"];
tmpl.scopes = tmpl.scopes && typeof tmpl.scopes === "object" ? tmpl.scopes : {};
tmpl.scopes.EXECUTE = ["hospitality:execute"];
tmpl.scopes.ANALYZE = ["hospitality:analyze"];
tmpl.scopes.ESCALATE = ["hospitality:escalate"];

// Rewrite any other domain prefixes conservatively.
function rewritePrefixes(x) {
  if (typeof x === "string") {
    return x
      .replaceAll("chc:", "hospitality:")
      .replaceAll("ciag:", "hospitality:");
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
