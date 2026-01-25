#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const FILE = "packages/sentinel-core/src/index.ts";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("export type RegisterExecutorFn")) {
  console.log("OK: RegisterExecutorFn already exported.");
  run("npm run build");
  process.exit(0);
}

if (!src.includes("DomainRegistry")) {
  throw new Error("Invariant violated: DomainRegistry not exported in sentinel-core index.ts");
}

src = src.trimEnd() + `

/**
 * Canonical executor registration function.
 * Derived from DomainRegistry to avoid duplication.
 */
export type RegisterExecutorFn = DomainRegistry["registerExecutor"];
`;

fs.writeFileSync(FILE, src + "\n");
console.log("Patched: added RegisterExecutorFn to sentinel-core public surface.");

run("npm test");
run("npm run build");
