#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

# Guardrail: no deep imports like @chc/nexus-core/src/... or @chc/nexus-core/dist/...
# We allow "@chc/nexus-core" only.

if grep -R --line-number -E '@chc/nexus-core/' "$ROOT/src" "$ROOT/packages" 2>/tmp/nexus_deep_imports.txt; then
  echo "---- offending deep import lines ----"
  cat /tmp/nexus_deep_imports.txt
  echo "FAIL: nexus-core deep imports detected. Use '@chc/nexus-core' only."
  exit 1
fi

echo "OK: no nexus-core deep imports detected."

