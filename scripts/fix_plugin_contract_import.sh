#!/usr/bin/env bash
set -euo pipefail

FILE="src/contracts/plugin.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/contracts/plugin.ts";
let s = fs.readFileSync(file, "utf8");

// 1) Remove ExecutorRegistryLike import
s = s.replace(
  /import type\s*\{\s*ExecutorRegistryLike\s*\}\s*from\s*["']\.\/registry["'];?\n?/g,
  ""
);

// 2) Ensure RegisterExecutorFn is imported
if (!s.includes("RegisterExecutorFn")) {
  s = s.replace(
    /import type\s*\{/,
    'import type { RegisterExecutorFn, '
  );
  s = s.replace(
    /from\s*["']\.\/registry["'];/,
    'from "./registry";'
  );
}

// 3) Ensure PluginRegistrar uses function form
s = s.replace(
  /PluginRegistrar\s*=\s*\([\s\S]*?\)\s*=>\s*void;/m,
  "PluginRegistrar = (register: RegisterExecutorFn) => void;"
);

fs.writeFileSync(file, s);
console.log("Plugin contract import aligned to RegisterExecutorFn");
NODE

npm run build
