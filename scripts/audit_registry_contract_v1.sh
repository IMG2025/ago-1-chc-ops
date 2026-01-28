#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const EXPECTED = ["chc","ciag","hospitality"]; // canonical contract

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains();
if (!Array.isArray(domains) || domains.length === 0) fail("No mounted domains discovered.");

const sorted = domains.slice().sort();
const expectedSorted = EXPECTED.slice().sort();

if (JSON.stringify(sorted) !== JSON.stringify(expectedSorted)) {
  fail(`Registry domain set drift. expected=${JSON.stringify(expectedSorted)} got=${JSON.stringify(sorted)}`);
}

// Lock executor_id integrity (non-empty string) per domain
for (const d of EXPECTED) {
  const exec = registry.get(d);
  if (!exec) fail(`Missing executor for domain: ${d}`);
  if (exec.domain_id !== d) fail(`Executor domain_id mismatch for ${d}: got=${exec.domain_id}`);
  if (typeof exec.executor_id !== "string" || !exec.executor_id.length) fail(`executor_id missing/invalid for ${d}`);
}

console.log("OK: registry contract locked (domains + executor_id integrity):", EXPECTED);
NODE
