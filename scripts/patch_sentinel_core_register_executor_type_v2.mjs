#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const FILE = "packages/sentinel-core/src/index.ts";
let src = fs.readFileSync(FILE, "utf8");

// Idempotency guard
if (src.includes("export type RegisterExecutorFn")) {
  console.log("OK: RegisterExecutorFn already exported.");
  run("npm run build");
  process.exit(0);
}

// Invariant: Registry must be public
if (!src.includes("Registry")) {
  throw new Error("Invariant violated: Registry not exported in sentinel-core index.ts");
}

src = src.trimEnd() + `

/**
 * Canonical executor registration function.
 * Derived from Registry to avoid duplication.
 */
export type RegisterExecutorFn = Registry["registerExecutor"];
`;

fs.writeFileSync(FILE, src + "\n");
console.log("Patched: added RegisterExecutorFn derived from Registry.");

run("npm test");
run("npm run build");
