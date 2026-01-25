#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const FILE = "packages/sentinel-core/src/plugin.ts";
if (!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}`);

let src = fs.readFileSync(FILE, "utf8");

// 1) Remove any exported const alias for mountCHCOpsPlugins (canonical policy: function only)
const before = src;
src = src.replace(
  /^\s*export\s+const\s+mountCHCOpsPlugins\s*=\s*[^;]+;\s*\n/gm,
  ""
);

// 2) Ensure exactly one exported function mountCHCOpsPlugins exists.
// If none exists, create a minimal wrapper after registerHospitality.
const fnMatches = src.match(/export\s+function\s+mountCHCOpsPlugins\s*\(/g) || [];

if (fnMatches.length === 0) {
  // Insert after registerHospitality declaration block if possible
  const anchor = /export\s+function\s+registerHospitality\s*\([^)]*\)\s*:\s*void\s*\{/m;
  const m = src.match(anchor);
  if (!m || m.index === undefined) {
    throw new Error("Could not locate registerHospitality() to anchor wrapper insertion.");
  }

  // Find end of registerHospitality function by naive brace scan from match index
  const start = m.index;
  let i = src.indexOf("{", start);
  if (i === -1) throw new Error("registerHospitality brace not found.");
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        i++; // include closing brace
        break;
      }
    }
  }
  if (depth !== 0) throw new Error("Unbalanced braces while scanning registerHospitality.");

  const wrapper = `

/**
 * CHC Ops compatibility mount.
 * Canonical export: function (NOT const alias).
 */
export function mountCHCOpsPlugins(registry: any): void {
  const register = registry?.registerExecutor?.bind?.(registry);
  if (typeof register !== "function") {
    throw new Error("mountCHCOpsPlugins: registry.registerExecutor is required");
  }
  registerHospitality(register);
}
`;

  src = src.slice(0, i) + wrapper + src.slice(i);
} else if (fnMatches.length > 1) {
  // Keep the first exported function, remove subsequent duplicates (best-effort block removal)
  let seen = 0;
  src = src.replace(
    /export\s+function\s+mountCHCOpsPlugins\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g,
    (block) => {
      seen++;
      return seen === 1 ? block : "";
    }
  );

  // Re-check
  const post = src.match(/export\s+function\s+mountCHCOpsPlugins\s*\(/g) || [];
  if (post.length !== 1) {
    throw new Error(`Failed to deduplicate mountCHCOpsPlugins functions (found ${post.length}).`);
  }
}

// 3) Final invariant: no exported const alias remains; exactly one exported function exists
if (/export\s+const\s+mountCHCOpsPlugins\s*=/m.test(src)) {
  throw new Error("Invariant violated: export const mountCHCOpsPlugins still present.");
}
const finalFns = src.match(/export\s+function\s+mountCHCOpsPlugins\s*\(/g) || [];
if (finalFns.length !== 1) {
  throw new Error(`Invariant violated: expected 1 exported function mountCHCOpsPlugins, found ${finalFns.length}.`);
}

// 4) Write only if changed
if (src !== before) {
  fs.writeFileSync(FILE, src);
  console.log("Patched: sentinel-core plugin.ts canonicalized mountCHCOpsPlugins (function-only).");
} else {
  console.log("OK: sentinel-core plugin.ts already canonical (no-op).");
}

// 5) Gates
run("npm -w @chc/sentinel-core run build");
run("npm run build");
