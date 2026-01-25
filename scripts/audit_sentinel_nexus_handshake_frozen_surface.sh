#!/usr/bin/env bash
mkdir -p ".tmp"
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PKG="$ROOT/packages/nexus-core"

HANDSHAKE="$PKG/src/handshake.ts"
INDEX="$PKG/src/index.ts"

if [[ ! -f "$HANDSHAKE" ]]; then
  echo "FAIL: missing $HANDSHAKE"
  exit 1
fi
if [[ ! -f "$INDEX" ]]; then
  echo "FAIL: missing $INDEX"
  exit 1
fi

# 1) No star exports anywhere in nexus-core/src (belt + suspenders)
if grep -R --line-number -E '^\s*export\s+\*\s+from\s+' "$PKG/src" >.tmp/nexus_star_exports.txt 2>/dev/null; then
  echo "---- offending export * lines ----"
  cat .tmp/nexus_star_exports.txt
  echo "FAIL: nexus-core must not use 'export * from ...'"
  exit 1
fi

# 2) Handshake must remain v1-labeled and must not deep-import sentinel internals.
if ! grep -q 'Handshake Contract (v1)' "$HANDSHAKE"; then
  echo "FAIL: handshake missing v1 header guard"
  exit 1
fi

# Disallow deep imports into sentinel-core internals:
# - "@chc/sentinel-core/" (anything after slash)
if grep -R --line-number -E '@chc/sentinel-core/' "$HANDSHAKE" >.tmp/handshake_deep_imports.txt 2>/dev/null; then
  echo "---- offending deep import lines ----"
  cat .tmp/handshake_deep_imports.txt
  echo "FAIL: handshake must not deep-import sentinel-core. Use '@chc/sentinel-core' only."
  exit 1
fi

# 3) Ensure nexus index exports handshake explicitly (surface lock)
if ! grep -q 'from "./handshake.js"' "$INDEX"; then
  echo "FAIL: nexus-core index.ts must export handshake surface explicitly"
  exit 1
fi

echo "OK: sentinel↔nexus handshake frozen surface audit passed."
