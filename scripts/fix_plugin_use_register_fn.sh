#!/usr/bin/env bash
set -euo pipefail

FILE="src/plugin.ts"

if [ ! -f "$FILE" ]; then
  echo "No src/plugin.ts found. Nothing to patch."
  npm run build
  exit 0
fi

node - <<'NODE'
import fs from "fs";

const file = "src/plugin.ts";
let s = fs.readFileSync(file, "utf8");

// Convert reg.registerExecutor(spec) -> reg(spec)
// Keep it conservative: only rewrite the specific method name.
s = s.replace(
  /\b([A-Za-z_$][\w$]*)\.registerExecutor\s*\(\s*([^)]+?)\s*\)\s*;/g,
  (_, regName, arg) => `${regName}(${arg});`
);

fs.writeFileSync(file, s);
console.log("Patched plugin: reg.registerExecutor(x) -> reg(x)");
NODE

npm run build
