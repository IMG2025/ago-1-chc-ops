#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const EXPECTED = ["chc","ciag","hospitality"].sort();

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains().slice().sort();
if (JSON.stringify(domains) !== JSON.stringify(EXPECTED)) {
  fail(`Mounted domains drift. expected=${JSON.stringify(EXPECTED)} got=${JSON.stringify(domains)}`);
}

const REQUIRED_TASKS = ["EXECUTE","ANALYZE","ESCALATE"];

for (const d of domains) {
  const exec = registry.get(d);
  if (!exec) fail(`Missing executor for domain: ${d}`);

  if (exec.domain_id !== d) fail(`Executor domain_id mismatch for ${d}: got=${exec.domain_id}`);

  const stt = Array.isArray(exec.supported_task_types) ? exec.supported_task_types.slice().sort() : [];
  if (JSON.stringify(stt) !== JSON.stringify(REQUIRED_TASKS.slice().sort())) {
    fail(`supported_task_types drift for ${d}: got=${JSON.stringify(exec.supported_task_types)}`);
  }

  if (!exec.required_scopes || typeof exec.required_scopes !== "object") {
    fail(`required_scopes missing/invalid for ${d}`);
  }
  for (const t of REQUIRED_TASKS) {
    const v = exec.required_scopes[t];
    if (!Array.isArray(v) || v.length === 0 || v.some(x => typeof x !== "string" || !x.length)) {
      fail(`required_scopes[${t}] invalid for ${d}: got=${JSON.stringify(v)}`);
    }
  }
}

console.log("OK: mount contract locked for domains:", domains);
NODE
