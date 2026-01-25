#!/usr/bin/env bash
set -euo pipefail

FILE="src/contracts/plugin.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/contracts/plugin.ts";
let s = fs.readFileSync(file, "utf8");

// 1) Ensure we import RegisterExecutorFn from ./registry
if (!/RegisterExecutorFn/.test(s)) {
  if (/from\s*["']\.\/registry["']/.test(s)) {
    // add to existing import
    s = s.replace(
      /import type\s*\{([^}]*)\}\s*from\s*["']\.\/registry["'];?/,
      (m, inner) => {
        const parts = inner.split(",").map(x => x.trim()).filter(Boolean);
        if (!parts.includes("RegisterExecutorFn")) parts.unshift("RegisterExecutorFn");
        return `import type { ${parts.join(", ")} } from "./registry";`;
      }
    );
  } else {
    // no import yet
    s = `import type { RegisterExecutorFn } from "./registry";\n` + s;
  }
}

// 2) Remove any lingering ExecutorRegistryLike references (type name only)
s = s.replace(/\bExecutorRegistryLike\b/g, "RegisterExecutorFn");

// 3) Normalize the exported alias name to our locked contract
// If file currently defines RegisterPluginFn or RegisterPluginInFn, make it RegisterPluginFn = (register: RegisterExecutorFn) => void;
s = s.replace(
  /export\s+type\s+RegisterPlugin\w*\s*=\s*\(\s*\w+\s*:\s*RegisterExecutorFn\s*\)\s*=>\s*void\s*;/,
  "export type RegisterPluginFn = (register: RegisterExecutorFn) => void;"
);

// If it still has old shape but with RegisterExecutorFn after replacement, force the canonical signature.
if (!/export type RegisterPluginFn\s*=\s*\(\s*register\s*:\s*RegisterExecutorFn\s*\)\s*=>\s*void\s*;/.test(s)) {
  s = s.replace(
    /export\s+type\s+RegisterPlugin\w*\s*=\s*\(\s*\w+\s*:\s*RegisterExecutorFn\s*\)\s*=>\s*void\s*;/,
    "export type RegisterPluginFn = (register: RegisterExecutorFn) => void;"
  );
}

fs.writeFileSync(file, s);
console.log("contracts/plugin.ts: RegisterPluginFn aligned to RegisterExecutorFn");
NODE

npm run build
