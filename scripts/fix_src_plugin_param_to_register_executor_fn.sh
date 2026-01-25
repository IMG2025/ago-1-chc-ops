#!/usr/bin/env bash
set -euo pipefail

FILE="src/plugin.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/plugin.ts";
let s = fs.readFileSync(file, "utf8");

// 1) Ensure we import RegisterExecutorFn (and stop importing PluginRegistrar/RegisterPluginFn if present)
s = s.replace(
  /import\s+type\s+\{[^}]*\b(PluginRegistrar|RegisterPluginFn)\b[^}]*\}\s+from\s+["'][^"']*contracts\/plugin\.js["'];\s*\n?/g,
  ""
);

// If there is already an import from contracts/registry.js, add RegisterExecutorFn to it.
// Otherwise, add a new import at the top.
if (/from\s+["']\.\/contracts\/registry\.js["']/.test(s)) {
  s = s.replace(
    /import\s+type\s+\{([^}]*)\}\s+from\s+["']\.\/contracts\/registry\.js["'];/g,
    (m, inner) => {
      const names = inner.split(",").map(x => x.trim()).filter(Boolean);
      if (!names.includes("RegisterExecutorFn")) names.push("RegisterExecutorFn");
      return `import type { ${names.join(", ")} } from "./contracts/registry.js";`;
    }
  );
} else {
  s = `import type { RegisterExecutorFn } from "./contracts/registry.js";\n` + s;
}

// 2) Fix function parameter typing: (reg: RegisterPluginFn) -> (register: RegisterExecutorFn)
// Covers common variants.
s = s.replace(/\(\s*reg\s*:\s*(PluginRegistrar|RegisterPluginFn)\s*\)/g, "(register: RegisterExecutorFn)");
s = s.replace(/\(\s*reg\s*:\s*RegisterExecutorFn\s*\)/g, "(register: RegisterExecutorFn)");

// 3) Fix call sites: reg(spec) -> register(spec)
s = s.replace(/\breg\s*\(/g, "register(");

fs.writeFileSync(file, s);
console.log("src/plugin.ts: aligned parameter + call sites to RegisterExecutorFn");
NODE

npm run build
