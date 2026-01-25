#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"

node - <<'NODE'
import fs from "node:fs";

const file = process.env.FILE ?? "src/executors.ts";
let s = fs.readFileSync(file, "utf8");

const re = /export const ciagExecutorSpec\s*:\s*ExecutorSpec\s*=\s*{[\s\S]*?required_scopes\s*:\s*{\s*[\s\S]*?\s*}\s*,/m;

const desiredRequiredScopesBlock =
`required_scopes: {
    EXECUTE: ["ciag:execute"],
    ANALYZE: ["ciag:analyze"],
    ESCALATE: ["ciag:escalate"],
  },`;

if (!re.test(s)) {
  console.error("ERROR: Could not find ciagExecutorSpec required_scopes block in src/executors.ts");
  process.exit(1);
}

const before = s;

s = s.replace(re, (m) => {
  // Replace only the required_scopes object inside the matched ciagExecutorSpec chunk
  return m.replace(/required_scopes\s*:\s*{\s*[\s\S]*?\s*}\s*,/m, desiredRequiredScopesBlock);
});

// Idempotency check
if (s === before) {
  console.log("CIAG required_scopes already canonical (no-op).");
} else {
  fs.writeFileSync(file, s);
  console.log("Updated CIAG required_scopes to canonical ciag:* scopes.");
}
NODE

npm run build
