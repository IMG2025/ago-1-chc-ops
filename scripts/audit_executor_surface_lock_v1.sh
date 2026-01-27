#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains().slice().sort();
if (!domains.length) fail("No mounted domains discovered.");

const ALLOWED_KEYS = new Set([
  "domain_id",
  "executor_id",
  "supported_task_types",
  "required_scopes",
  "domain_action_scopes",
  "validate_inputs",
  "execute",
]);

const REQUIRED_KEYS = [
  "domain_id",
  "executor_id",
  "supported_task_types",
  "required_scopes",
  "validate_inputs",
  "execute",
];

const bad = [];
for (const d of domains) {
  const exec = registry.get(d);
  if (!exec) { bad.push({ domain: d, error: "MISSING_EXECUTOR" }); continue; }

  for (const k of Object.keys(exec)) {
    if (!ALLOWED_KEYS.has(k)) bad.push({ domain: d, error: "UNAPPROVED_KEY", key: k });
  }

  for (const k of REQUIRED_KEYS) {
    if (!(k in exec)) bad.push({ domain: d, error: "MISSING_KEY", key: k });
  }

  if (typeof exec.validate_inputs !== "function") bad.push({ domain: d, error: "INVALID_VALIDATE_INPUTS" });
  if (typeof exec.execute !== "function") bad.push({ domain: d, error: "INVALID_EXECUTE" });
}

if (bad.length) {
  console.error("FAIL: executor surface lock violated:");
  for (const b of bad) console.error("-", JSON.stringify(b));
  process.exit(1);
}

console.log("OK: executor surface lock passed for domains:", domains);
NODE
