#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

mkdir -p src/diagnostics

cat > src/diagnostics/listDomains.ts <<'TS'
import { createRegistry } from "../registry.js";
import { mountCHCOpsPlugins } from "../index.js";

const registry = createRegistry();
mountCHCOpsPlugins(registry);

console.log("Mounted domains:", registry.listDomains());
TS

# Ensure build emits the new file
npm run build
