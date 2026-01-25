#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

if ! grep -q "export function createRegistry" "$FILE"; then
  cat >> "$FILE" <<'TS'

export function createRegistry(): ExecutorRegistry {
  return new DomainRegistry();
}
TS
fi

npm run build
