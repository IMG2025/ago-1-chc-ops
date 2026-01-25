#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const DIAG = "packages/sentinel-core/src/diagnostics/listDomains.ts";

if (!fs.existsSync(PLUGIN)) throw new Error(`Missing: ${PLUGIN}`);
if (!fs.existsSync(DIAG)) throw new Error(`Missing: ${DIAG}`);

let plugin = fs.readFileSync(PLUGIN, "utf8");
let diag = fs.readFileSync(DIAG, "utf8");

// 1) Canonicalize plugin.ts mountCHCOpsPlugins to accept BOTH registrar fn and registry object.
//    We do this by:
//    - keeping RegisterExecutorFn = (spec) => void
//    - adding overload signatures
//    - implementing runtime dispatch based on presence of registerExecutor
//
// Idempotent approach: replace the entire mountCHCOpsPlugins block if present.
const mountBlockRe =
/\/\*\*[\s\S]*?\*\/\s*export function mountCHCOpsPlugins\s*\([\s\S]*?\n\}\s*\n?/m;

const mountBlock =
`/**
 * Back-compat mount entrypoint.
 * Supports two calling styles:
 *  - mountCHCOpsPlugins(registerFn)
 *  - mountCHCOpsPlugins(registryWithRegisterExecutor)
 */
export function mountCHCOpsPlugins(register: RegisterExecutorFn): void;
export function mountCHCOpsPlugins(registry: ExecutorRegistry): void;
export function mountCHCOpsPlugins(arg: RegisterExecutorFn | ExecutorRegistry): void {
  const register: RegisterExecutorFn =
    typeof arg === "function"
      ? arg
      : (spec) => arg.registerExecutor(spec);

  register(hospitalityExecutorSpec);
}
`;

// Ensure plugin imports include ExecutorRegistry/ExecutorSpec (they should already from v5)
if (!/import type\s+\{\s*ExecutorRegistry,\s*ExecutorSpec\s*\}\s+from\s+"\.\/registry\.js";/m.test(plugin)) {
  // Replace any existing registry import with the canonical one
  plugin = plugin.replace(
    /^import type\s+\{[^}]*\}\s+from\s+"\.\/registry\.js";\s*$/m,
    `import type { ExecutorRegistry, ExecutorSpec } from "./registry.js";`
  );
  if (!/import type\s+\{\s*ExecutorRegistry,\s*ExecutorSpec\s*\}\s+from\s+"\.\/registry\.js";/m.test(plugin)) {
    // If no registry import existed, add it at top
    plugin = `import type { ExecutorRegistry, ExecutorSpec } from "./registry.js";\n` + plugin;
  }
}

// Replace mount block (or append if missing)
if (mountBlockRe.test(plugin)) {
  plugin = plugin.replace(mountBlockRe, mountBlock);
} else if (/export function mountCHCOpsPlugins\s*\(/.test(plugin)) {
  // fallback: if signature exists but comment block didn't match, replace the function body by a simpler regex
  plugin = plugin.replace(/export function mountCHCOpsPlugins[\s\S]*?\n\}\s*\n?/m, mountBlock);
} else {
  plugin = plugin.trimEnd() + "\n\n" + mountBlock;
}

fs.writeFileSync(PLUGIN, plugin.trimEnd() + "\n");

// 2) Fix diagnostics/listDomains.ts to call mountCHCOpsPlugins(registry) (still valid) OR
//    ensure it isn’t importing the wrong symbol shape.
//    Since we now overload, leaving mountCHCOpsPlugins(registry) is fine.
//    But some earlier versions might have changed the callsite; we canonicalize it.
diag = diag.replace(
  /mountCHCOpsPlugins\s*\(\s*([^)]+)\s*\)\s*;/g,
  "mountCHCOpsPlugins($1);"
);

// Additionally, if it was changed to pass a function, keep it; otherwise do nothing.
// No further mutation needed.
fs.writeFileSync(DIAG, diag.trimEnd() + "\n");

console.log("OK: sentinel-core mountCHCOpsPlugins overloaded (fn or registry) + diagnostics call canonicalized.");

// Gates
run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
