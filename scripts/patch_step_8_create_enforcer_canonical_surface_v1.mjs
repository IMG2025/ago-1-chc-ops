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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPTS = "scripts";
const ATTIC = path.join(SCRIPTS, "_attic", "step-8");
ensureDir(ATTIC);

const CANON = [
  "patch_step_8_lock_policy_execution_binding_v1.mjs",
  "patch_step_8_termux_bridge_handshake_types_v1.mjs",
];

const ENFORCER = path.join(SCRIPTS, "patch_step_8_enforce_canonical_surface_v1.mjs");
const AUDIT = path.join(SCRIPTS, "audit_step_8_canonical_surface.sh");

// 1) Create the enforcer script (idempotent)
const enforcerSrc = `#!/usr/bin/env node
/**
 * Step 8 Canonical Surface Enforcer (v1)
 *
 * Purpose:
 * - Ensure Step 8 remains operationally clean: only canonical scripts in /scripts.
 * - Allow attic scripts for traceability.
 *
 * Guardrails:
 * - Deterministic + idempotent.
 * - Does not run builds; it enforces repo layout invariants only.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function readDir(p) { return fs.readdirSync(p, { withFileTypes: true }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPTS = "scripts";
const ATTIC = path.join(SCRIPTS, "_attic", "step-8");

const CANON = new Set(${JSON.stringify(CANON, null, 2)});

if (!fs.existsSync(SCRIPTS)) {
  console.error("FAIL: missing scripts/ directory");
  process.exit(1);
}

if (!fs.existsSync(ATTIC)) {
  console.error("FAIL: missing scripts/_attic/step-8 (expected for hygiene)");
  process.exit(1);
}

// Find Step-8 scripts in scripts/
const entries = readDir(SCRIPTS)
  .filter(d => d.isFile() && d.name.startsWith("patch_step_8_") && d.name.endsWith(".mjs"))
  .map(d => d.name);

// Enforcer is allowed to exist in /scripts in addition to canonical patch scripts
const ALLOWED = new Set([...CANON, "patch_step_8_enforce_canonical_surface_v1.mjs", "patch_step_8_create_enforcer_canonical_surface_v1.mjs"]);

const unexpected = entries.filter(n => !ALLOWED.has(n));

if (unexpected.length) {
  console.error("FAIL: unexpected Step-8 scripts present in scripts/ (move to scripts/_attic/step-8):");
  for (const n of unexpected) console.error(" - " + n);
  process.exit(1);
}

// Ensure canonical scripts exist
for (const n of CANON) {
  const p = path.join(SCRIPTS, n);
  if (!fs.existsSync(p)) {
    console.error("FAIL: missing canonical Step-8 script: " + p);
    process.exit(1);
  }
}

console.log("OK: Step 8 canonical surface enforced (scripts clean; attic present).");
`;
writeIfChanged(ENFORCER, enforcerSrc);
fs.chmodSync(ENFORCER, 0o755);

// 2) Create audit wrapper (idempotent)
const auditSrc = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
node scripts/patch_step_8_enforce_canonical_surface_v1.mjs
`;
writeIfChanged(AUDIT, auditSrc);
fs.chmodSync(AUDIT, 0o755);

// 3) Wire audit into Termux gate runner (idempotent)
const gate = path.join(SCRIPTS, "gate_ci_termux_v1.sh");
if (!exists(gate)) {
  throw new Error("Invariant: missing scripts/gate_ci_termux_v1.sh (expected to exist).");
}
let gateSrc = read(gate);
if (!gateSrc.includes("audit_step_8_canonical_surface.sh")) {
  // Insert right after TMPROOT setup (safe anchor)
  const anchor = 'mkdir -p "$TMPROOT"';
  const idx = gateSrc.indexOf(anchor);
  if (idx === -1) throw new Error("Invariant: could not locate TMPROOT mkdir anchor in gate_ci_termux_v1.sh");
  const insert = `${anchor}

# Step 8 canonical hygiene gate (fast fail)
./scripts/audit_step_8_canonical_surface.sh
`;
  gateSrc = gateSrc.replace(anchor, insert);
  writeIfChanged(gate, gateSrc);
}

// 4) Prove idempotency + gates (must end with npm run build)
console.log("OK: created Step 8 enforcer + audit; wired into Termux gate runner.");
run("node scripts/patch_step_8_enforce_canonical_surface_v1.mjs");
run("node scripts/patch_step_8_enforce_canonical_surface_v1.mjs");
run("./scripts/gate_ci_termux_v1.sh");
run("./scripts/gate_ci_termux_v1.sh");
run("npm test");
run("npm run build");
