#!/usr/bin/env bash
set -euo pipefail

npm run build

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

function expectOk(fn, label) {
  try { fn(); console.log("OK:", label); }
  catch (e) { console.error("FAIL:", label); throw e; }
}
function expectErrCode(fn, code, label) {
  try { fn(); console.error("FAIL (expected err):", label); process.exit(1); }
  catch (e) {
    if (e?.code !== code) { console.error("FAIL wrong code:", label, "got", e?.code); throw e; }
    console.log("OK:", label, "=>", code);
  }
}

const r = new DomainRegistry();
mountCHCOpsPlugins(r);

const hosp = r.get("hospitality");
if (!hosp) throw new Error("Missing hospitality domain");

const execScope = hosp.required_scopes.EXECUTE?.[0];
const analyzeScope = hosp.required_scopes.ANALYZE?.[0];
const escalateScope = hosp.required_scopes.ESCALATE?.[0];

if (!execScope || !analyzeScope || !escalateScope) {
  throw new Error("hospitality required_scopes missing one or more task types");
}

expectOk(() => r.authorize("hospitality", "EXECUTE", execScope), "authorize hospitality EXECUTE w/ required scope");
expectOk(() => r.authorize("hospitality", { type: "ANALYZE" }, analyzeScope), "authorize hospitality ANALYZE w/ required scope");
expectOk(() => r.authorize("hospitality", { task_type: "ESCALATE" }, escalateScope), "authorize hospitality ESCALATE w/ required scope");

expectErrCode(() => r.authorize("hospitality", "EXECUTE", "hospitality:wrong"), "MISSING_SCOPE", "wrong scope");
NODE

npm run build
