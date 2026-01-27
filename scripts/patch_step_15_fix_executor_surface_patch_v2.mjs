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
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const PATCH = "scripts/patch_step_15_lock_executor_surface_v1.mjs";
const PKG = "package.json";
if (!exists(PKG)) throw new Error("Missing: package.json");

const canonicalPatch = `#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const AUDIT = "scripts/audit_executor_surface_lock_v1.sh";
const PKG = "package.json";
if (!exists(PKG)) throw new Error("Missing: package.json");

const auditSrc = \`#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains().slice().sort();
if (!domains.length) fail("No mounted domains discovered.");

const ALLOWED_KEYS = new Set([
  "domain_id",
  "executor_id",
  "supported_task_types",
  "required_scopes",
  "domain_action_scopes",
  "validate_inputs",
  "execute",
]);

const REQUIRED_KEYS = [
  "domain_id",
  "executor_id",
  "supported_task_types",
  "required_scopes",
  "validate_inputs",
  "execute",
];

const bad = [];
for (const d of domains) {
  const exec = registry.get(d);
  if (!exec) { bad.push({ domain: d, error: "MISSING_EXECUTOR" }); continue; }

  for (const k of Object.keys(exec)) {
    if (!ALLOWED_KEYS.has(k)) bad.push({ domain: d, error: "UNAPPROVED_KEY", key: k });
  }

  for (const k of REQUIRED_KEYS) {
    if (!(k in exec)) bad.push({ domain: d, error: "MISSING_KEY", key: k });
  }

  if (typeof exec.validate_inputs !== "function") bad.push({ domain: d, error: "INVALID_VALIDATE_INPUTS" });
  if (typeof exec.execute !== "function") bad.push({ domain: d, error: "INVALID_EXECUTE" });
}

if (bad.length) {
  console.error("FAIL: executor surface lock violated:");
  for (const b of bad) console.error("-", JSON.stringify(b));
  process.exit(1);
}

console.log("OK: executor surface lock passed for domains:", domains);
NODE
\`;

writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log(\`OK: wrote \${AUDIT}\`);

// Wire into npm test (idempotent)
const pkg = JSON.parse(read(PKG));
const t = pkg.scripts?.test;
if (typeof t !== "string") throw new Error("Invariant: scripts.test missing or not a string.");

if (!t.includes("./scripts/audit_executor_surface_lock_v1.sh")) {
  let next = t;

  if (next.includes("./scripts/audit_mount_contract_v1.sh")) {
    next = next.replace(
      "./scripts/audit_mount_contract_v1.sh",
      "./scripts/audit_mount_contract_v1.sh && ./scripts/audit_executor_surface_lock_v1.sh"
    );
  } else if (next.includes("./scripts/audit_executor_action_scopes_canonical_v1.sh")) {
    next = next.replace(
      "./scripts/audit_executor_action_scopes_canonical_v1.sh",
      "./scripts/audit_executor_action_scopes_canonical_v1.sh && ./scripts/audit_executor_surface_lock_v1.sh"
    );
  } else if (next.includes("./scripts/audit_executor_spec_schema_v1.sh")) {
    next = next.replace(
      "./scripts/audit_executor_spec_schema_v1.sh",
      "./scripts/audit_executor_spec_schema_v1.sh && ./scripts/audit_executor_surface_lock_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_executor_surface_lock_v1.sh";
  }

  pkg.scripts.test = next;
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\\n");
  console.log("OK: wired executor surface lock audit into npm test");
} else {
  console.log("OK: executor surface lock audit already wired into npm test");
}

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
\`;

writeIfChanged(PATCH, canonicalPatch + "\n");
chmod755(PATCH);
console.log("OK: repaired scripts/patch_step_15_lock_executor_surface_v1.mjs (canonical, no escaped backticks).");

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
