#!/usr/bin/env bash
set -euo pipefail

FILE="src/index.ts"

# Ensure file exists
test -f "$FILE"

# 1) Ensure we import DomainRegistry (idempotent)
if ! grep -qE 'from "\./registry"' "$FILE"; then
  # add at top (after existing imports if any)
  awk 'NR==1{print "import { DomainRegistry } from \"./registry\";"} {print}' "$FILE" > "$FILE.tmp"
  mv "$FILE.tmp" "$FILE"
fi

# 2) Replace any ExecutorRegistryLike typing with DomainRegistry typing (idempotent)
# Handles: mountCHCOpsPlugins(registry: ExecutorRegistryLike)
sed -i 's/mountCHCOpsPlugins(\s*registry:\s*ExecutorRegistryLike\s*)/mountCHCOpsPlugins(registry: DomainRegistry)/g' "$FILE"

# Also handles untyped param: mountCHCOpsPlugins(registry)
# (only if it exists)
sed -i 's/mountCHCOpsPlugins(\s*registry\s*)/mountCHCOpsPlugins(registry: DomainRegistry)/g' "$FILE"

# 3) Ensure exports remain (no-op if already correct)
# (We do not force reformat; we just ensure buildable signature.)

npm run build
