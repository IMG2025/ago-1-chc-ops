#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

# Replace any loose ExecutorRegistryLike definition
sed -i 's/(spec: unknown)/(spec: ExecutorSpec)/g' "$FILE"

npm run build
