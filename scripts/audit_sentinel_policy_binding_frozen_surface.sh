#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

IDX="packages/sentinel-core/src/index.ts"

if ! test -f "$IDX"; then
  echo "FAIL: missing sentinel-core index: $IDX" >&2
  exit 1
fi

# 1) Must explicitly export binding symbols (no hidden/deep imports)
grep -q 'createGovernanceGatewayV1' "$IDX" || { echo "FAIL: sentinel-core index.ts must export createGovernanceGatewayV1" >&2; exit 1; }
grep -q 'PolicyEngine' "$IDX" || { echo "FAIL: sentinel-core index.ts must export PolicyEngine type" >&2; exit 1; }
grep -q 'PolicyRule' "$IDX" || { echo "FAIL: sentinel-core index.ts must export PolicyRule type" >&2; exit 1; }

# 2) No star exports in sentinel-core public surface
if grep -Eq '^\s*export\s+\*\s+from\s+' "$IDX"; then
  echo "FAIL: sentinel-core index.ts must not contain star exports" >&2
  exit 1
fi

echo "OK: sentinel-core policy binding frozen surface audit passed."
