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

const domains = registry.listDomains();
if (!domains.length) fail("No mounted domains discovered.");

const bad = [];
for (const d of domains) {
  const exec = registry.get(d);
  const das = exec?.domain_action_scopes;
  if (!das || typeof das !== "object") continue;

  for (const [action, v] of Object.entries(das)) {
    if (!Array.isArray(v) || v.length === 0 || v.some(x => typeof x !== "string" || !x.length)) {
      bad.push({ domain: d, action, got: v });
    }
  }
}

if (bad.length) {
  console.error("FAIL: domain_action_scopes must be canonical string[] for every action key.");
  for (const b of bad) console.error("-", b.domain, b.action, JSON.stringify(b.got));
  process.exit(1);
}

console.log("OK: executor domain_action_scopes are canonical (string[]) for:", domains);
NODE
