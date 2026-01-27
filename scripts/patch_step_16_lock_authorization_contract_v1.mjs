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

const AUDIT = "scripts/audit_authorization_contract_v1.sh";

// ------------------------------------------------------------
// 1) Read-only authorization contract audit
//    Locks:
//    - stable error codes (by matching canonical smoke output lines)
//    - cross-domain namespace spoofing detection
//    - action-scope subset denial code
// ------------------------------------------------------------
const auditSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

tmp="$(mktemp)"
cleanup() { rm -f "$tmp"; }
trap cleanup EXIT

run_and_capture() {
  local label="$1"
  shift
  echo "==> $label" >>"$tmp"
  # capture stdout+stderr so the contract can’t drift silently
  ( "$@" ) 2>&1 | tee -a "$tmp" >/dev/null
}

# These scripts must exist (contract inputs)
req=(
  "./scripts/smoke_authorize.sh"
  "./scripts/smoke_authorize_hospitality.sh"
  "./scripts/smoke_authorize_chc.sh"
  "./scripts/smoke_action_scope_subset_gate.sh"
  "./scripts/smoke_cross_domain_scope_spoofing.sh"
)
for s in "${req[@]}"; do
  [[ -x "$s" ]] || { echo "FAIL: missing or not executable: $s"; exit 1; }
done

run_and_capture "smoke_authorize" ./scripts/smoke_authorize.sh
run_and_capture "smoke_authorize_hospitality" ./scripts/smoke_authorize_hospitality.sh
run_and_capture "smoke_authorize_chc" ./scripts/smoke_authorize_chc.sh
run_and_capture "smoke_action_scope_subset_gate" ./scripts/smoke_action_scope_subset_gate.sh
run_and_capture "smoke_cross_domain_scope_spoofing" ./scripts/smoke_cross_domain_scope_spoofing.sh

# Canonical contract lines (freeze these)
expect=(
  "OK: unknown domain => UNKNOWN_DOMAIN"
  "OK: invalid task type => INVALID_TASK"
  "OK: wrong scope => MISSING_SCOPE"
  "OK: wrong scope for task type => MISSING_SCOPE"

  "OK: action scope subset gate => ACTION_SCOPE_NOT_ALLOWED"
  "OK: ciag EXECUTE with hospitality scope => INVALID_SCOPE_NAMESPACE"
  "OK: hospitality EXECUTE with ciag scope => INVALID_SCOPE_NAMESPACE"
)

for line in "${expect[@]}"; do
  if ! grep -Fqx "$line" "$tmp"; then
    echo "FAIL: authorization contract drift detected (missing line): $line"
    echo "---- tail(contract-log) ----"
    tail -n 160 "$tmp" || true
    exit 1
  fi
done

echo "OK: authorization contract locked (error codes + namespace spoofing + subset gate)"
`;

writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log(`OK: wrote ${AUDIT}`);

// ------------------------------------------------------------
// 2) Wire into npm test (idempotent)
//    Prefer to run after smoke_cross_domain_scope_spoofing (since it’s the latest auth-related check).
// ------------------------------------------------------------
const pkg = JSON.parse(read(PKG));
const t = pkg.scripts?.test;
if (typeof t !== "string") throw new Error("Invariant: scripts.test missing or not a string.");

if (!t.includes("./scripts/audit_authorization_contract_v1.sh")) {
  let next = t;

  if (next.includes("./scripts/smoke_cross_domain_scope_spoofing.sh")) {
    next = next.replace(
      "./scripts/smoke_cross_domain_scope_spoofing.sh",
      "./scripts/smoke_cross_domain_scope_spoofing.sh && ./scripts/audit_authorization_contract_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_authorization_contract_v1.sh";
  }

  pkg.scripts.test = next;
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: wired authorization contract audit into npm test");
} else {
  console.log("OK: authorization contract audit already wired into npm test");
}

// ------------------------------------------------------------
// 3) Gates (must end with npm run build)
// ------------------------------------------------------------
run("npm test");
run("npm run build");
