#!/usr/bin/env bash
set -euo pipefail

npm run build

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";

const r = new DomainRegistry();

function expectErr(fn, code) {
  try { fn(); console.error("FAIL: expected", code); process.exit(1); }
  catch (e) {
    if (e?.code !== code) { console.error("FAIL: wrong code", e?.code, "expected", code); throw e; }
    console.log("OK: invalid scope namespace =>", code);
  }
}

expectErr(() => r.registerExecutor({
  domain_id: "demo",
  executor_id: "demoExecutor",
  supported_task_types: ["EXECUTE"],
  required_scopes: { EXECUTE: ["task:execute"] }, // invalid namespace
  validate_inputs: (raw) => raw,
  execute: (raw) => ({ ok: true, raw }),
}), "INVALID_SCOPE_NAMESPACE");

expectErr(() => r.registerExecutor({
  domain_id: "demo2",
  executor_id: "demo2Executor",
  supported_task_types: ["EXECUTE"],
  required_scopes: { EXECUTE: [] }, // missing
  validate_inputs: (raw) => raw,
  execute: (raw) => ({ ok: true, raw }),
}), "MISSING_REQUIRED_SCOPES");
NODE

npm run build
