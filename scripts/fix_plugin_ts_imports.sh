#!/usr/bin/env bash
set -euo pipefail

# Ensure contracts exist (source-of-truth, not dist)
mkdir -p src/contracts

if [[ ! -f src/contracts/plugin.ts ]]; then
  cat > src/contracts/plugin.ts <<'TS'
export interface PluginRegistrar<TSpec> {
  registerExecutor(spec: TSpec): void;
}
TS
fi

if [[ ! -f src/contracts/index.ts ]]; then
  cat > src/contracts/index.ts <<'TS'
export * from "./plugin.js";
TS
fi

# Ensure executor module exists for plugin.ts to import
# (If your project already has a different executor spec file, this won't harm it,
# but guarantees ./executor.js resolves.)
if [[ ! -f src/executor.ts ]]; then
  cat > src/executor.ts <<'TS'
export type HospitalityExecutorSpec = Readonly<{
  id: string;
  name: string;
}>;
TS
fi

# Rewrite plugin.ts to import from source paths (never from our own dist)
# We do a safe rewrite: replace any "ago-1-chc-ops/dist/contracts/plugin.js" import with "./contracts/plugin.js"
sed -i \
  -e 's|from "ago-1-chc-ops/dist/contracts/plugin.js"|from "./contracts/plugin.js"|g' \
  -e "s|from 'ago-1-chc-ops/dist/contracts/plugin.js'|from './contracts/plugin.js'|g" \
  src/plugin.ts || true

npm run build
