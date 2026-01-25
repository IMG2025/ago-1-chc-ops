#!/usr/bin/env bash
set -euo pipefail

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

const r = new DomainRegistry();
mountCHCOpsPlugins(r);

const h = r.get("hospitality");
const c = r.get("ciag");

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exit(1); }
}

assert(h, "hospitality domain missing");
assert(
  Array.isArray(h.supported_task_types) &&
  h.supported_task_types.includes("EXECUTE") &&
  h.supported_task_types.includes("ANALYZE") &&
  h.supported_task_types.includes("ESCALATE"),
  "hospitality supported_task_types missing EXECUTE/ANALYZE/ESCALATE"
);

assert(h.required_scopes?.EXECUTE?.[0] === "hospitality:execute", "hospitality EXECUTE scope not canonical");
assert(h.required_scopes?.ANALYZE?.[0] === "hospitality:analyze", "hospitality ANALYZE scope not canonical");
assert(h.required_scopes?.ESCALATE?.[0] === "hospitality:escalate", "hospitality ESCALATE scope not canonical");

assert(c, "ciag domain missing");
assert(c.required_scopes?.EXECUTE?.[0] === "ciag:execute", "ciag EXECUTE scope not canonical");
assert(c.required_scopes?.ANALYZE?.[0] === "ciag:analyze", "ciag ANALYZE scope not canonical");
assert(c.required_scopes?.ESCALATE?.[0] === "ciag:escalate", "ciag ESCALATE scope not canonical");

console.log("OK: mount uses canonical local specs for hospitality + ciag");
NODE

npm run build
