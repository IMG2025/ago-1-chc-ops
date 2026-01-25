#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const gitignore = ".gitignore";
const ignoreLines = [
  "# build outputs",
  "**/dist/",
  "**/*.tsbuildinfo",
  "# never commit emitted artifacts in src/",
  "packages/*/src/**/*.js",
  "packages/*/src/**/*.d.ts",
  "packages/*/src/**/*.map",
];

const prevIg = exists(gitignore) ? read(gitignore) : "";
let nextIg = prevIg.trimEnd();
for (const line of ignoreLines) {
  if (!nextIg.split("\n").includes(line)) nextIg += (nextIg ? "\n" : "") + line;
}
writeIfChanged(gitignore, nextIg.trimEnd() + "\n");

// Ensure nexus-core builds to dist (not src)
const nexusTsconfig = "packages/nexus-core/tsconfig.json";
if (!exists(nexusTsconfig)) {
  throw new Error(`Missing: ${nexusTsconfig}`);
}
const ts = JSON.parse(read(nexusTsconfig));
ts.compilerOptions ??= {};
const co = ts.compilerOptions;

// Enforce conventional layout
if (!co.rootDir) co.rootDir = "src";
if (!co.outDir) co.outDir = "dist";
if (co.outDir !== "dist") co.outDir = "dist";
if (co.rootDir !== "src") co.rootDir = "src";

// Ensure declarations emitted to dist as well
co.declaration ??= true;
co.declarationMap ??= true;
co.sourceMap ??= true;

writeIfChanged(nexusTsconfig, JSON.stringify(ts, null, 2) + "\n");

// Remove emitted artifacts that were accidentally committed in src/
const emittedGlobs = [
  "packages/nexus-core/src/*.js",
  "packages/nexus-core/src/*.d.ts",
  "packages/nexus-core/src/*.map",
  "packages/nexus-core/src/**/*.js",
  "packages/nexus-core/src/**/*.d.ts",
  "packages/nexus-core/src/**/*.map",
];

// Use git rm --cached if tracked; rm if untracked.
for (const g of emittedGlobs) {
  try { execSync(`git ls-files "${g}"`, { stdio: "pipe" }); run(`git rm -r --cached --ignore-unmatch ${g}`); } catch {}
}

// Clean physical files from working tree if present (they’ll be regenerated into dist/)
try { run(`find packages/nexus-core/src -type f \\( -name "*.js" -o -name "*.d.ts" -o -name "*.map" \\) -print -delete`); } catch {}

// Rebuild and ensure clean status aside from intended changes
run("npm run build");

console.log("OK: cleaned emitted artifacts; nexus-core now emits to dist; gitignore updated; build complete.");
