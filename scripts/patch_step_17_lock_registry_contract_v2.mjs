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

const PKG = "package.json";
if (!exists(PKG)) throw new Error("Missing: package.json");

const BROKEN = "scripts/patch_step_17_lock_registry_contract_v1.mjs";
if (exists(BROKEN)) {
  const stub = `#!/usr/bin/env node
/**
 * DEPRECATED/BROKEN: v1 included escaped backticks which break JS parsing.
 * Use scripts/patch_step_17_lock_registry_contract_v2.mjs instead.
 */
import { execSync } from "node:child_process";
execSync("npm test", { stdio: "inherit" });
execSync("npm run build", { stdio: "inherit" });
`;
  writeIfChanged(BROKEN, stub);
  chmod755(BROKEN);
  console.log("OK: stubbed broken patch_step_17_lock_registry_contract_v1.mjs");
}

const AUDIT = "scripts/audit_registry_contract_v1.sh";

const auditSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const EXPECTED = ["chc","ciag","hospitality"]; // canonical contract

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains();
if (!Array.isArray(domains) || domains.length === 0) fail("No mounted domains discovered.");

const sorted = domains.slice().sort();
const expectedSorted = EXPECTED.slice().sort();

if (JSON.stringify(sorted) !== JSON.stringify(expectedSorted)) {
  fail(\`Registry domain set drift. expected=\${JSON.stringify(expectedSorted)} got=\${JSON.stringify(sorted)}\`);
}

// Lock executor_id integrity (non-empty string) per domain
for (const d of EXPECTED) {
  const exec = registry.get(d);
  if (!exec) fail(\`Missing executor for domain: \${d}\`);
  if (exec.domain_id !== d) fail(\`Executor domain_id mismatch for \${d}: got=\${exec.domain_id}\`);
  if (typeof exec.executor_id !== "string" || !exec.executor_id.length) fail(\`executor_id missing/invalid for \${d}\`);
}

console.log("OK: registry contract locked (domains + executor_id integrity):", EXPECTED);
NODE
`;

writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log("OK: wrote " + AUDIT);

// Wire into npm test (idempotent) – prefer after executor surface lock, else after mount contract
const pkg = JSON.parse(read(PKG));
const t = pkg.scripts?.test;
if (typeof t !== "string") throw new Error("Invariant: scripts.test missing or not a string.");

if (!t.includes("./scripts/audit_registry_contract_v1.sh")) {
  let next = t;

  if (next.includes("./scripts/audit_executor_surface_lock_v1.sh")) {
    next = next.replace(
      "./scripts/audit_executor_surface_lock_v1.sh",
      "./scripts/audit_executor_surface_lock_v1.sh && ./scripts/audit_registry_contract_v1.sh"
    );
  } else if (next.includes("./scripts/audit_mount_contract_v1.sh")) {
    next = next.replace(
      "./scripts/audit_mount_contract_v1.sh",
      "./scripts/audit_mount_contract_v1.sh && ./scripts/audit_registry_contract_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_registry_contract_v1.sh";
  }

  pkg.scripts.test = next;
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: wired registry contract audit into npm test");
} else {
  console.log("OK: registry contract audit already wired into npm test");
}

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
