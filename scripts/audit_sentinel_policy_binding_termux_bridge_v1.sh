#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BIND="packages/sentinel-core/src/policy_binding_v1.ts"
TS="packages/sentinel-core/tsconfig.json"
BRIDGE="packages/sentinel-core/src/nexus_handshake_bridge_v1.ts"

test -f "$BIND" || { echo "FAIL: missing $BIND" >&2; exit 1; }
test -f "$BRIDGE" || { echo "FAIL: missing $BRIDGE" >&2; exit 1; }

# 1) policy_binding must not import @chc/nexus-core directly under Termux bridge mode
if grep -q '@chc/nexus-core' "$BIND"; then
  echo "FAIL: policy_binding_v1.ts must not import @chc/nexus-core under Termux bridge mode" >&2
  exit 1
fi

# 2) sentinel-core tsconfig must not contain @chc/nexus-core/* (deep import guardrail)
if grep -q '@chc/nexus-core/*' "$TS" 2>/dev/null; then
  echo "FAIL: sentinel-core tsconfig must not contain @chc/nexus-core/*" >&2
  exit 1
fi

echo "OK: sentinel-core Termux handshake bridge audit passed."
