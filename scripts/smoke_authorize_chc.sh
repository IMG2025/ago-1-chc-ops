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

const hosp = r.get("chc");
if (!hosp) throw new Error("Missing chc domain");

const execScope = hosp.required_scopes.EXECUTE?.[0];
const analyzeScope = hosp.required_scopes.ANALYZE?.[0];
const escalateScope = hosp.required_scopes.ESCALATE?.[0];

if (!execScope || !analyzeScope || !escalateScope) {
  throw new Error("chc required_scopes missing one or more task types");
}

expectOk(() => r.authorize("chc", "EXECUTE", execScope), "authorize chc EXECUTE w/ required scope");
expectOk(() => r.authorize("chc", { type: "ANALYZE" }, analyzeScope), "authorize chc ANALYZE w/ required scope");
expectOk(() => r.authorize("chc", { task_type: "ESCALATE" }, escalateScope), "authorize chc ESCALATE w/ required scope");

expectErrCode(() => r.authorize("chc", "EXECUTE", "chc:wrong"), "MISSING_SCOPE", "wrong scope");
NODE

npm run build
