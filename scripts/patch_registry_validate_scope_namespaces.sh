#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

# Fail fast if file missing
[ -f "$FILE" ] || { echo "ERROR: $FILE not found"; exit 1; }

# If already patched, no-op
if rg -q "validateScopeNamespaces\\(spec\\);" "$FILE"; then
  echo "OK: validateScopeNamespaces already enforced (no-op)"
else
  perl -0777 -i -pe '
    s|(registerExecutor\\(spec:\\s*ExecutorSpec\\)\\s*:\\s*void\\s*\\{)|
     $1\n  validateScopeNamespaces(spec);\n|s
  ' "$FILE"
  echo "Patched: validateScopeNamespaces enforced at registration"
fi

npm run build
