#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const file = "src/plugin.ts";
if (!fs.existsSync(file)) {
  throw new Error("src/plugin.ts not found");
}

let src = fs.readFileSync(file, "utf8");

// 1. Remove any const export variants (idempotent)
src = src.replace(
  /export\s+const\s+mountCHCOpsPlugins\s*=\s*[^;]+;\s*/g,
  ""
);

// 2. Count exported function declarations
const fnMatches = src.match(/export\s+function\s+mountCHCOpsPlugins\s*\(/g) || [];

if (fnMatches.length === 0) {
  throw new Error("No exported function mountCHCOpsPlugins found");
}

if (fnMatches.length > 1) {
  // Keep the first, remove the rest
  let seen = false;
  src = src.replace(
    /export\s+function\s+mountCHCOpsPlugins\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g,
    (block) => {
      if (seen) return "";
      seen = true;
      return block;
    }
  );
}

// 3. Final sanity check
if (
  (src.match(/export\s+function\s+mountCHCOpsPlugins\s*\(/g) || []).length !== 1
) {
  throw new Error("Failed to canonicalize mountCHCOpsPlugins");
}

fs.writeFileSync(file, src.trimEnd() + "\n");

console.log("OK: mountCHCOpsPlugins canonicalized (single exported function)");
run("npm run build");
