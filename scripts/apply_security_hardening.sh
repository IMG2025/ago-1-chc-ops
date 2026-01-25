#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

run_if_present () {
  local f="$1"
  if [ -f "$f" ]; then
    chmod +x "$f" || true
    node "$f"
  fi
}

# Canonical hardening order (deterministic)
run_if_present scripts/patch_fix_authorize_class_method.mjs
run_if_present scripts/patch_authorize_define_spec.mjs
run_if_present scripts/patch_authorize_type_hardening.mjs
run_if_present scripts/patch_authorize_type_hardening_reanchor.mjs
run_if_present scripts/patch_fix_authorize_spec_injection.mjs

# Keep contract doc current (if present)
if [ -f scripts/apply_authorization_invariants_doc.sh ]; then
  chmod +x scripts/apply_authorization_invariants_doc.sh || true
  ./scripts/apply_authorization_invariants_doc.sh
fi

# Final gates (must end green)
npm test
npm run build
