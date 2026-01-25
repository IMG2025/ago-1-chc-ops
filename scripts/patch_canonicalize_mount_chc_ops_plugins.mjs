#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const FILE = "src/plugin.ts";
const src = fs.readFileSync(FILE, "utf8");

// 1. Remove any exported const alias
let next = src.replace(
  /export\s+const\s+mountCHCOpsPlugins\s*=\s*[^;]+;/g,
  ""
);

// 2. Ensure exactly one exported function remains
const fnMatches = next.match(/export\s+function\s+mountCHCOpsPlugins\s*\(/g) || [];
if (fnMatches.length !== 1) {
  throw new Error(
    `Invariant violated: expected exactly 1 exported function mountCHCOpsPlugins, found ${fnMatches.length}`
  );
}

// 3. Write back
fs.writeFileSync(FILE, next.trimEnd() + "\n");

console.log("OK: mountCHCOpsPlugins canonicalized (single exported function).");

// Final gate
run("npm run build");
