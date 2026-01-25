#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const INDEX = "packages/sentinel-core/src/index.ts";
const PLUGIN = "packages/sentinel-core/src/plugin.ts";

let indexSrc = fs.readFileSync(INDEX, "utf8");

// Idempotency guard
if (indexSrc.includes("RegisterExecutorFn")) {
  console.log("OK: RegisterExecutorFn already exported.");
  run("npm test");
  run("npm run build");
  process.exit(0);
}

// Ensure plugin exports registerExecutor
const pluginSrc = fs.readFileSync(PLUGIN, "utf8");
if (!pluginSrc.includes("registerExecutor")) {
  throw new Error("Invariant violated: registerExecutor not found in plugin.ts");
}

// Ensure index imports registerExecutor
if (!indexSrc.includes('from "./plugin.js"')) {
  indexSrc =
    indexSrc.trimEnd() +
    `\nimport { registerExecutor } from "./plugin.js";\n`;
}

// Append canonical type export
indexSrc =
  indexSrc.trimEnd() +
  `

/**
 * Canonical executor registration function.
 * Exported directly from sentinel-core authority.
 */
export type RegisterExecutorFn = typeof registerExecutor;
`;

fs.writeFileSync(INDEX, indexSrc + "\n");

console.log("Patched: exported RegisterExecutorFn from sentinel-core public surface.");

run("npm test");
run("npm run build");
