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

// Remove any generic usage of RegisterPluginFn<...>
s = s.replace(
  /RegisterPluginFn\s*<[^>]+>/g,
  "RegisterPluginFn"
);

fs.writeFileSync(file, s);
console.log("Patched RegisterPluginFn generic usage (removed <...>).");
NODE

npm run build
