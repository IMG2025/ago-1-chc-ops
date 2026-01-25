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

// Replace legacy import name → canonical contract name
s = s.replace(
  /import\s+type\s+\{\s*PluginRegistrar\s*\}\s+from\s+["']\.\/contracts\/plugin\.js["'];?/g,
  'import type { RegisterPluginFn } from "./contracts/plugin.js";'
);

// Replace any usage of PluginRegistrar → RegisterPluginFn
s = s.replace(/\bPluginRegistrar\b/g, "RegisterPluginFn");

fs.writeFileSync(file, s);
console.log("Patched src/plugin.ts to use RegisterPluginFn");
NODE

npm run build
