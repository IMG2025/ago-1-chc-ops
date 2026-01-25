#!/usr/bin/env sh
set -eu

npm run build >/dev/null

node - <<'NODE'
import { createRegistry } from "./dist/registry.js";

const registry = createRegistry();

// Minimal spec that violates: domain_action_scopes contains a scope not present in required_scopes union
const bad = {
  domain_id: "x",
  executor_id: "x",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["x:execute"],
    ANALYZE: ["x:analyze"],
    ESCALATE: ["x:escalate"],
  },
  domain_action_scopes: {
    BAD_ACTION: ["x:not-allowed"],
  },
  validate_inputs: (raw) => raw,
  execute: (raw) => raw,
};

try {
  registry.registerExecutor(bad);
  console.error("FAIL: expected ACTION_SCOPE_NOT_ALLOWED");
  process.exit(1);
} catch (e) {
  const code = e?.code || e?.meta?.code || e?.message;
  if (code === "ACTION_SCOPE_NOT_ALLOWED") {
    console.log("OK: action scope subset gate => ACTION_SCOPE_NOT_ALLOWED");
    process.exit(0);
  }
  console.error("FAIL: expected ACTION_SCOPE_NOT_ALLOWED, got:", code);
  process.exit(1);
}
NODE

npm run build >/dev/null
