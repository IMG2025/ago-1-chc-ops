#!/usr/bin/env bash
set -euo pipefail

FILE="src/plugin.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/plugin.ts";
let s = fs.readFileSync(file, "utf8");

// Replace any reg.registerExecutor(spec) with reg(spec)
s = s.replace(
  /\breg\s*\.\s*registerExecutor\s*\(\s*([^)]+)\s*\)\s*;/g,
  "reg($1);"
);

// Replace reg(spec) where reg was incorrectly typed as object call already handled
// (idempotent: no-op if already correct)

fs.writeFileSync(file, s);
console.log("plugin.ts: switched to direct RegisterExecutorFn invocation");
NODE

npm run build
