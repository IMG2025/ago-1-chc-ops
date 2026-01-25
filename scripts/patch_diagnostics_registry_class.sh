#!/usr/bin/env bash
set -euo pipefail

FILE="src/diagnostics/listDomains.ts"

mkdir -p src/diagnostics

cat > "$FILE" <<'TS'
import { DomainRegistry } from "../registry.js";
import { mountCHCOpsPlugins } from "../index.js";

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

console.log("Mounted domains:", registry.listDomains());
TS

npm run build
