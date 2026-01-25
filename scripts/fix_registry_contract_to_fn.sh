#!/usr/bin/env bash
set -euo pipefail

FILE="src/contracts/registry.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/contracts/registry.ts";
let s = fs.readFileSync(file, "utf8");

// Replace ExecutorRegistryLike interface with a function type
s = s.replace(
  /export type ExecutorRegistryLike\s*=\s*\{[\s\S]*?registerExecutor:\s*\(spec:\s*ExecutorSpec\)\s*=>\s*void;?\s*\};?/m,
  "export type RegisterExecutorFn = (spec: ExecutorSpec) => void;"
);

// Ensure export name consistency
s = s.replace(/\bExecutorRegistryLike\b/g, "RegisterExecutorFn");

fs.writeFileSync(file, s);
console.log("Registry contract collapsed to RegisterExecutorFn");
NODE

npm run build
