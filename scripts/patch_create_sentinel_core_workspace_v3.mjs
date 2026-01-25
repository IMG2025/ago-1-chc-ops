#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

function read(p) {
  return fs.readFileSync(p, "utf8");
}
function write(p, s) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, s);
}
function exists(p) {
  return fs.existsSync(p);
}

const rootPkgPath = path.join(ROOT, "package.json");
const rootPkg = JSON.parse(read(rootPkgPath));

// Ensure npm workspaces includes packages/*
const desired = "packages/*";
if (!rootPkg.workspaces) rootPkg.workspaces = [];
if (Array.isArray(rootPkg.workspaces)) {
  if (!rootPkg.workspaces.includes(desired)) rootPkg.workspaces.push(desired);
} else if (rootPkg.workspaces && Array.isArray(rootPkg.workspaces.packages)) {
  if (!rootPkg.workspaces.packages.includes(desired)) rootPkg.workspaces.packages.push(desired);
} else {
  // normalize to array form (safe default)
  rootPkg.workspaces = [desired];
}
write(rootPkgPath, JSON.stringify(rootPkg, null, 2) + "\n");

// Create packages/sentinel-core minimal package (idempotent)
const pkgDir = path.join(ROOT, "packages", "sentinel-core");
const srcDir = path.join(pkgDir, "src");
const distDir = path.join(pkgDir, "dist");

if (!exists(path.join(pkgDir, "package.json"))) {
  write(
    path.join(pkgDir, "package.json"),
    JSON.stringify(
      {
        name: "@chc/sentinel-core",
        version: "0.0.1",
        private: true,
        type: "module",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            default: "./dist/index.js"
          }
        },
        scripts: {
          build: "tsc -p tsconfig.json"
        }
      },
      null,
      2
    ) + "\n"
  );
}

if (!exists(path.join(pkgDir, "tsconfig.json"))) {
  write(
    path.join(pkgDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          declaration: true,
          declarationMap: false,
          sourceMap: false,
          outDir: "./dist",
          rootDir: "./src",
          skipLibCheck: true
        },
        include: ["src/**/*.ts"]
      },
      null,
      2
    ) + "\n"
  );
}

if (!exists(path.join(srcDir, "index.ts"))) {
  write(
    path.join(srcDir, "index.ts"),
    `/**
 * @chc/sentinel-core
 * Minimal scaffold. We will migrate shared contracts + registry into here in the next step.
 */
export type SentinelCoreScaffold = {
  ok: true;
};

export const sentinelCoreScaffold: SentinelCoreScaffold = { ok: true };
`
  );
}

// Ensure dist dir exists (harmless)
fs.mkdirSync(distDir, { recursive: true });

console.log("OK: packages/sentinel-core scaffolded (minimal, compiling).");

// Final gate (per policy)
run("npm -w @chc/sentinel-core run build");
run("npm run build");
