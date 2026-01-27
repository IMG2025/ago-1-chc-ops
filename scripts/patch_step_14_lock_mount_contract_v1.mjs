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

const AUDIT = "scripts/audit_mount_contract_v1.sh";
const PKG = "package.json";

if (!exists(PKG)) throw new Error("Missing: package.json");

const auditSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const EXPECTED = ["chc","ciag","hospitality"].sort();

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains().slice().sort();
if (JSON.stringify(domains) !== JSON.stringify(EXPECTED)) {
  fail(\`Mounted domains drift. expected=\${JSON.stringify(EXPECTED)} got=\${JSON.stringify(domains)}\`);
}

const REQUIRED_TASKS = ["EXECUTE","ANALYZE","ESCALATE"];

for (const d of domains) {
  const exec = registry.get(d);
  if (!exec) fail(\`Missing executor for domain: \${d}\`);

  if (exec.domain_id !== d) fail(\`Executor domain_id mismatch for \${d}: got=\${exec.domain_id}\`);

  const stt = Array.isArray(exec.supported_task_types) ? exec.supported_task_types.slice().sort() : [];
  if (JSON.stringify(stt) !== JSON.stringify(REQUIRED_TASKS.slice().sort())) {
    fail(\`supported_task_types drift for \${d}: got=\${JSON.stringify(exec.supported_task_types)}\`);
  }

  if (!exec.required_scopes || typeof exec.required_scopes !== "object") {
    fail(\`required_scopes missing/invalid for \${d}\`);
  }
  for (const t of REQUIRED_TASKS) {
    const v = exec.required_scopes[t];
    if (!Array.isArray(v) || v.length === 0 || v.some(x => typeof x !== "string" || !x.length)) {
      fail(\`required_scopes[\${t}] invalid for \${d}: got=\${JSON.stringify(v)}\`);
    }
  }
}

console.log("OK: mount contract locked for domains:", domains);
NODE
`;
writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log(`OK: wrote ${AUDIT}`);

// Wire into npm test (idempotent)
const pkg = JSON.parse(read(PKG));
const t = pkg.scripts?.test;
if (typeof t !== "string") throw new Error("Invariant: scripts.test missing or not a string.");

if (!t.includes("./scripts/audit_mount_contract_v1.sh")) {
  let next = t;
  // Place after mount + schema validations when possible
  if (next.includes("./scripts/audit_executor_action_scopes_canonical_v1.sh")) {
    next = next.replace(
      "./scripts/audit_executor_action_scopes_canonical_v1.sh",
      "./scripts/audit_executor_action_scopes_canonical_v1.sh && ./scripts/audit_mount_contract_v1.sh"
    );
  } else if (next.includes("./scripts/audit_executor_spec_schema_v1.sh")) {
    next = next.replace(
      "./scripts/audit_executor_spec_schema_v1.sh",
      "./scripts/audit_executor_spec_schema_v1.sh && ./scripts/audit_mount_contract_v1.sh"
    );
  } else if (next.includes("./scripts/audit_domain_spec_schema_v1.sh")) {
    next = next.replace(
      "./scripts/audit_domain_spec_schema_v1.sh",
      "./scripts/audit_domain_spec_schema_v1.sh && ./scripts/audit_mount_contract_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_mount_contract_v1.sh";
  }

  pkg.scripts.test = next;
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: wired mount contract audit into npm test");
} else {
  console.log("OK: mount contract audit already wired into npm test");
}

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
