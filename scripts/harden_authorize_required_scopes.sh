#!/usr/bin/env bash
set -euo pipefail

FILE="src/authorize.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/authorize.ts";
let s = fs.readFileSync(file, "utf8");

if (s.includes("MISSING_REQUIRED_SCOPES_FOR_TASKS")) {
  console.log("authorize.ts already hardened (no-op).");
  process.exit(0);
}

s = s.replace(
  /export function assertAuthorized\s*\([\s\S]*?\)\s*\{/m,
  (m) => m + `
  // Sentinel invariant: every supported task type must define required scopes
  const missing = spec.supported_task_types.filter(
    t => !spec.required_scopes || !spec.required_scopes[t]
  );

  if (missing.length > 0) {
    throw new Error(
      \`MISSING_REQUIRED_SCOPES_FOR_TASKS:\${missing.join(",")}\`
    );
  }
`
);

fs.writeFileSync(file, s);
console.log("Authorization hardened: required_scopes must cover all supported_task_types.");
NODE

npm run build
