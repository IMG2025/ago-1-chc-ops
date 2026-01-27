#!/usr/bin/env bash
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
  ( "$@" ) 2>&1 | tee -a "$tmp" >/dev/null
}

# These scripts must exist (contract inputs)
REQ_SCRIPTS="./scripts/smoke_authorize.sh ./scripts/smoke_authorize_hospitality.sh ./scripts/smoke_authorize_chc.sh ./scripts/smoke_action_scope_subset_gate.sh ./scripts/smoke_cross_domain_scope_spoofing.sh"
for s in $REQ_SCRIPTS; do
  [[ -x "$s" ]] || { echo "FAIL: missing or not executable: $s"; exit 1; }
done

run_and_capture "smoke_authorize" ./scripts/smoke_authorize.sh
run_and_capture "smoke_authorize_hospitality" ./scripts/smoke_authorize_hospitality.sh
run_and_capture "smoke_authorize_chc" ./scripts/smoke_authorize_chc.sh
run_and_capture "smoke_action_scope_subset_gate" ./scripts/smoke_action_scope_subset_gate.sh
run_and_capture "smoke_cross_domain_scope_spoofing" ./scripts/smoke_cross_domain_scope_spoofing.sh

# Canonical contract lines (freeze these)
EXPECT_LINES="OK: unknown domain => UNKNOWN_DOMAIN
OK: invalid task type => INVALID_TASK
OK: wrong scope => MISSING_SCOPE
OK: wrong scope for task type => MISSING_SCOPE
OK: action scope subset gate => ACTION_SCOPE_NOT_ALLOWED
OK: ciag EXECUTE with hospitality scope => INVALID_SCOPE_NAMESPACE
OK: hospitality EXECUTE with ciag scope => INVALID_SCOPE_NAMESPACE"

while IFS= read -r line; do
  [[ -n "$line" ]] || continue
  if ! grep -Fqx "$line" "$tmp"; then
    echo "FAIL: authorization contract drift detected (missing line): $line"
    echo "---- tail(contract-log) ----"
    tail -n 160 "$tmp" || true
    exit 1
  fi
done <<< "$EXPECT_LINES"

echo "OK: authorization contract locked (error codes + namespace spoofing + subset gate)"
