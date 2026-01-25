#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

# Only add if not already present
if ! grep -q "export interface ExecutorRegistry" "$FILE"; then
  sed -i '1i\
export interface ExecutorRegistry {\
  registerExecutor(spec: ExecutorSpec): void;\
}\
' "$FILE"
fi

npm run build
