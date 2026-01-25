#!/usr/bin/env bash
set -euo pipefail

npm run build

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function expectOk(fn, label) {
  try {
    fn();
    console.log("OK:", label);
  } catch (e) {
    console.error("FAIL (expected OK):", label);
    console.error(e);
    process.exit(1);
  }
}

function expectErrCode(fn, code, label) {
  try {
    fn();
    console.error("FAIL (expected error):", label);
    process.exit(1);
  } catch (e) {
    const got = (e && typeof e === "object") ? e.code : undefined;
    if (got !== code) {
      console.error("FAIL (wrong code):", label, "expected", code, "got", got);
      console.error(e);
      process.exit(1);
    }
    console.log("OK:", label, "=>", code);
  }
}

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

// These scope strings must match what executors declare.
// We will probe by reading spec directly (no hidden assumptions).
const ciag = registry.get("ciag");
const hosp = registry.get("hospitality");
if (!ciag || !hosp) throw new Error("Smoke setup failed: missing expected domains.");

const ciagExecuteScope = ciag.required_scopes.EXECUTE?.[0];
const ciagAnalyzeScope  = ciag.required_scopes.ANALYZE?.[0];
const ciagEscalateScope = ciag.required_scopes.ESCALATE?.[0];

// CIAG scope presence validated implicitly via authorize()

// Happy-path checks
expectOk(() => registry.authorize("ciag", "EXECUTE", ciagExecuteScope), "authorize ciag EXECUTE with required scope");
expectOk(() => registry.authorize("ciag", { type: "ANALYZE" }, ciagAnalyzeScope), "authorize ciag ANALYZE with required scope");
expectOk(() => registry.authorize("ciag", { task_type: "ESCALATE" }, ciagEscalateScope), "authorize ciag ESCALATE with required scope");

// Negative checks
expectErrCode(() => registry.authorize("nope", "EXECUTE", ciagExecuteScope), "UNKNOWN_DOMAIN", "unknown domain");
expectErrCode(() => registry.authorize("ciag", "NOT_A_TASK", ciagExecuteScope), "INVALID_TASK", "invalid task type");
expectErrCode(() => registry.authorize("ciag", "EXECUTE", "ciag:wrong"), "MISSING_SCOPE", "wrong scope");
expectErrCode(() => registry.authorize("ciag", "EXECUTE", ciagAnalyzeScope), "MISSING_SCOPE", "wrong scope for task type");
NODE
