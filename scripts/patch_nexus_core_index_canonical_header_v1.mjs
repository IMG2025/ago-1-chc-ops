#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const IDX = "packages/nexus-core/src/index.ts";
if (!fs.existsSync(IDX)) throw new Error(`Missing: ${IDX}`);

let src = read(IDX);

// Guardrail: never allow star exports in index.ts
if (/^\s*export\s+\*\s+from\s+/m.test(src)) {
  throw new Error("Invariant violated: nexus-core index.ts contains `export * from ...`");
}

// Ensure canonical header required by audit: grep -q 'Canonical Public Surface (v1)'
const REQUIRED = "Canonical Public Surface (v1)";
const desiredLine = `// ${REQUIRED}`;

// Remove any leading blank lines
src = src.replace(/^\s*\n+/, "");

// If first line is a comment, replace it; otherwise prepend.
if (/^\s*\/\/.*\n/.test(src)) {
  src = src.replace(/^\s*\/\/.*\n/, desiredLine + "\n");
} else {
  src = desiredLine + "\n" + src;
}

// Belt + suspenders: ensure the required substring exists somewhere
if (!src.includes(REQUIRED)) {
  src = desiredLine + "\n" + src.replace(/^\s*\/\/.*\n/, "");
}

writeIfChanged(IDX, src.trimEnd() + "\n");

console.log("OK: nexus-core index.ts canonical header enforced (Canonical Public Surface (v1)).");

// Idempotent gates
run("npm -w @chc/nexus-core run build");
run("npm test");
run("npm run build");
