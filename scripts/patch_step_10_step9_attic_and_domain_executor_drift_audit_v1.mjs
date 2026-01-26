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
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function exists(p) { return fs.existsSync(p); }
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

// ------------------------------------------------------------
// 1) Move superseded Step-9 scripts to attic (traceability; repo hygiene)
// ------------------------------------------------------------
const SCRIPTS_DIR = "scripts";
const ATTIC = path.join(SCRIPTS_DIR, "_attic", "step-9");
ensureDir(ATTIC);

// Keep the latest working Step-9 fix script OUTSIDE attic for now.
// (We can later consolidate into a single canonical step-9 script.)
const KEEP = new Set([
  "patch_step_9_fix_chc_executor_shape_v3.mjs",
  "patch_step_10_step9_attic_and_domain_executor_drift_audit_v1.mjs",
]);

const STEP9_PREFIX = /^patch_step_9_.*\.mjs$/;

function moveToAttic(name) {
  const src = path.join(SCRIPTS_DIR, name);
  if (!exists(src)) return false;

  // Never move KEEP items.
  if (KEEP.has(name)) return false;

  const dst = path.join(ATTIC, name);
  if (!exists(dst)) fs.renameSync(src, dst);
  else fs.rmSync(src, { force: true });
  return true;
}

let moved = 0;

// Move any patch_step_9_*.mjs except KEEP
for (const ent of fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true })) {
  if (!ent.isFile()) continue;
  if (!STEP9_PREFIX.test(ent.name)) continue;
  if (moveToAttic(ent.name)) moved++;
}

// Attic README (idempotent)
const readme = path.join(ATTIC, "README.md");
const readmeTxt = `# Step 9 Attic

This directory contains superseded Step-9 patch scripts retained for traceability.

## Canonical Step-9 script currently retained in /scripts
- scripts/patch_step_9_fix_chc_executor_shape_v3.mjs

## Why attic?
- Keep /scripts as the operator “happy path”
- Preserve historical repair trails without operational noise
`;
writeIfChanged(readme, readmeTxt);

console.log(`OK: moved ${moved} superseded Step-9 patch script(s) to ${ATTIC}.`);

// ------------------------------------------------------------
// 2) Add executor↔domain spec drift audit (idempotent)
//    Guardrail: executor.required_scopes[T] must be allowed by domains/<id>.domain.json scopes[T].
// ------------------------------------------------------------
const AUDIT = "scripts/audit_domain_executor_alignment_v1.sh";
const auditSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Build first (dist/* is the source of truth for audits)
npm run build >/dev/null

node - <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains();
if (!Array.isArray(domains) || domains.length === 0) fail("No mounted domains discovered.");

for (const domainId of domains) {
  const specPath = path.join("domains", \`\${domainId}.domain.json\`);
  if (!fs.existsSync(specPath)) fail(\`Missing domain spec file: \${specPath}\`);

  let spec;
  try { spec = JSON.parse(fs.readFileSync(specPath, "utf8")); }
  catch (e) { fail(\`Invalid JSON in \${specPath}: \${e?.message ?? e}\`); }

  const exec = registry.get(domainId);
  if (!exec) fail(\`Mounted domain missing from registry.get(): \${domainId}\`);

  const required = exec.required_scopes ?? {};
  const scopes = spec.scopes ?? {};

  // For each task type required by executor, ensure the primary required scope is present in spec.scopes[taskType]
  for (const taskType of ["EXECUTE", "ANALYZE", "ESCALATE"]) {
    const execScopes = required[taskType];
    if (!execScopes || !Array.isArray(execScopes) || execScopes.length === 0) continue;

    const primary = execScopes[0];
    const specScopes = scopes[taskType];

    if (!specScopes || !Array.isArray(specScopes)) {
      fail(\`Domain \${domainId}: spec.scopes.\${taskType} missing/invalid; expected to include \${primary}\`);
    }
    if (!specScopes.includes(primary)) {
      fail(\`Domain \${domainId}: executor requires \${primary} for \${taskType}, but spec.scopes.\${taskType} does not include it\`);
    }
  }
}

console.log("OK: domain specs align with executor required_scopes for all mounted domains:", domains);
NODE
`;
writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log("OK: wrote audit_domain_executor_alignment_v1.sh");

// ------------------------------------------------------------
// 3) Wire audit into npm test chain (idempotent)
// ------------------------------------------------------------
const pkgPath = "package.json";
if (!exists(pkgPath)) throw new Error("Missing: package.json");

const pkg = JSON.parse(read(pkgPath));
const testCmd = pkg.scripts?.test;
if (typeof testCmd !== "string") throw new Error("Invariant: package.json scripts.test missing or not a string.");

if (!testCmd.includes("audit_domain_executor_alignment_v1.sh")) {
  // Insert right after audit_mount_canonical_specs.sh if present; else append.
  let next = testCmd;
  if (testCmd.includes("./scripts/audit_mount_canonical_specs.sh")) {
    next = testCmd.replace(
      "./scripts/audit_mount_canonical_specs.sh",
      "./scripts/audit_mount_canonical_specs.sh && ./scripts/audit_domain_executor_alignment_v1.sh"
    );
  } else {
    next = testCmd + " && ./scripts/audit_domain_executor_alignment_v1.sh";
  }
  pkg.scripts.test = next;
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: wired drift audit into npm test");
} else {
  console.log("OK: drift audit already wired into npm test");
}

// ------------------------------------------------------------
// 4) Gates (must end with npm run build)
// ------------------------------------------------------------
run("npm test");
run("npm run build");
