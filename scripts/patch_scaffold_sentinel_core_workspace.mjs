#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const PKG_DIR = path.join(ROOT, "packages", "sentinel-core");
const SRC_DIR = path.join(PKG_DIR, "src");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeIfMissing(file, content) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);
}

function patchJson(file, mutate) {
  const raw = fs.readFileSync(file, "utf8");
  const obj = JSON.parse(raw);
  const next = mutate(obj) || obj;
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
}

ensureDir(SRC_DIR);

writeIfMissing(
  path.join(PKG_DIR, "package.json"),
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

writeIfMissing(
  path.join(PKG_DIR, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        outDir: "dist",
        rootDir: "src",
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        strict: true,
        skipLibCheck: true
      },
      include: ["src/**/*.ts"]
    },
    null,
    2
  ) + "\n"
);

writeIfMissing(
  path.join(SRC_DIR, "index.ts"),
  `// Sentinel Core (scaffold)
export const sentinelCoreScaffolded = true;
`
);

// wire npm workspaces (idempotent)
patchJson(path.join(ROOT, "package.json"), (pkg) => {
  pkg.workspaces = pkg.workspaces || [];
  const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : (pkg.workspaces.packages || []);
  const has = ws.includes("packages/*") || ws.includes("packages/sentinel-core");
  if (!has) {
    if (Array.isArray(pkg.workspaces)) pkg.workspaces.push("packages/*");
    else {
      pkg.workspaces.packages = pkg.workspaces.packages || [];
      if (!pkg.workspaces.packages.includes("packages/*")) pkg.workspaces.packages.push("packages/*");
    }
  }
  return pkg;
});

// ensure root install resolves workspaces
run("npm install");

// final gate
run("npm run build");
