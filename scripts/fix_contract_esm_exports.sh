#!/usr/bin/env bash
set -euo pipefail

FILE="src/contracts/index.ts"

cat > "$FILE" <<'TS'
export * from "./executor.js";
export * from "./registry.js";
export * from "./plugin.js";
TS

echo "Rewritten src/contracts/index.ts:"
sed -n '1,200p' "$FILE"

npm run build
