#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PKG="$ROOT/packages/nexus-core"

# 1) No star exports anywhere in nexus-core/src
if grep -R --line-number -E '^\s*export\s+\*\s+from\s+' "$PKG/src" >/tmp/nexus_star_exports.txt 2>/dev/null; then
  echo "---- offending export * lines ----"
  cat /tmp/nexus_star_exports.txt
  echo "FAIL: nexus-core must not use 'export * from ...'"
  exit 1
fi

# 2) index.ts must be canonical (only allowed exports)
IDX="$PKG/src/index.ts"
if [[ ! -f "$IDX" ]]; then
  echo "FAIL: missing $IDX"
  exit 1
fi

# quick sanity checks — keep strict to prevent drift
if ! grep -q 'Canonical Public Surface (v1)' "$IDX"; then
  echo "FAIL: nexus-core index.ts missing canonical header"
  exit 1
fi

echo "OK: nexus-core frozen surface audit passed."

