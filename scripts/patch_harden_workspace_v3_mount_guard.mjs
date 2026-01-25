#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "packages/sentinel-core/src/plugin.ts";

if (!fs.existsSync(FILE)) {
  console.log("OK: sentinel-core not present; nothing to harden.");
  process.exit(0);
}

let src = fs.readFileSync(FILE, "utf8");

// Count exported mount symbols
const matches = src.match(/export\s+(const|function)\s+mountCHCOpsPlugins\b/g) || [];

if (matches.length <= 1) {
  console.log("OK: mountCHCOpsPlugins already canonical.");
  execSync("npm run build", { stdio: "inherit" });
  process.exit(0);
}

// Remove ALL const aliases
src = src.replace(
  /export\s+const\s+mountCHCOpsPlugins\s*=\s*[^;]+;/g,
  ""
);

// Final invariant check
const finalCount =
  (src.match(/export\s+function\s+mountCHCOpsPlugins\b/g) || []).length;

if (finalCount !== 1) {
  throw new Error(
    `Invariant violated: expected exactly 1 exported function mountCHCOpsPlugins, found ${finalCount}`
  );
}

fs.writeFileSync(FILE, src.trimEnd() + "\n");

console.log("Patched: removed duplicate mountCHCOpsPlugins aliases");

// Final gate
execSync("npm run build", { stdio: "inherit" });
