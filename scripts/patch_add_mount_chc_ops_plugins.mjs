#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const file = "src/plugin.ts";
let src = fs.readFileSync(file, "utf8");

// Idempotency gate
if (/export\s+function\s+mountCHCOpsPlugins\s*\(/.test(src)) {
  console.log("OK: mountCHCOpsPlugins already present (no-op).");
  run("npm run build");
  process.exit(0);
}

// Ensure DomainRegistry type import exists (ESM-friendly .js)
const needsDomainRegistry =
  !/\bDomainRegistry\b/.test(src) ||
  !/import\s+type\s+\{\s*DomainRegistry\s*\}\s+from\s+["']\.\/registry\.js["']/.test(src);

if (needsDomainRegistry) {
  const importLine = 'import type { DomainRegistry } from "./registry.js";\n';

  if (!src.includes(importLine.trim())) {
    // Insert after the last import line if any, else at top.
    const importMatches = [...src.matchAll(/^(import[\s\S]*?;\s*)$/gm)];
    if (importMatches.length > 0) {
      const last = importMatches[importMatches.length - 1];
      const insertAt = (last.index ?? 0) + last[0].length;
      src = src.slice(0, insertAt) + importLine + src.slice(insertAt);
    } else {
      src = importLine + src;
    }
  }
}

// Append the compatibility mount wrapper at EOF
src = src.trimEnd() + `

/**
 * CHC Ops compatibility mount.
 * Do NOT remove — consumed by diagnostics/ops tooling.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  const register = registry.registerExecutor.bind(registry) as unknown as RegisterExecutorFn;
  registerHospitality(register);
}
` + "\n";

fs.writeFileSync(file, src);
console.log("OK: mountCHCOpsPlugins added to src/plugin.ts.");

run("npm run build");
