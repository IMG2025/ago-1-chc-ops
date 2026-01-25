#!/usr/bin/env bash
set -euo pipefail

echo "== SRC (ciagExecutorSpec required_scopes) =="
rg -n "export const ciagExecutorSpec|required_scopes|ESCALATE|ciag:escalate" src/executors.ts || true
echo
sed -n '/export const ciagExecutorSpec/,/};/p' src/executors.ts | sed -n '1,120p' || true

echo
echo "== DIST (executors.js) =="
if [ -f dist/executors.js ]; then
  rg -n "ciagExecutorSpec|required_scopes|ESCALATE|ciag:escalate" dist/executors.js || true
else
  echo "dist/executors.js not found"
fi

echo
echo "== DIST (what mount registers) =="
node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

const r = new DomainRegistry();
mountCHCOpsPlugins(r);

const ciag = r.get("ciag");
console.log("CIAG supported_task_types =", ciag?.supported_task_types);
console.log("CIAG required_scopes =", ciag?.required_scopes);
NODE

npm run build
