#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const TARGET = "scripts/patch_create_sentinel_core_workspace_v3.mjs";
if (!fs.existsSync(TARGET)) {
  throw new Error(`Missing ${TARGET}`);
}

let src = fs.readFileSync(TARGET, "utf8");

// Idempotency short-circuit
if (src.includes("IDEMPOTENCY_GUARD_SENTINEL_CORE_EXISTS")) {
  console.log("OK: v3 already idempotent (no-op).");
  run("npm run build");
  process.exit(0);
}

// Ensure fs import
if (!/^\s*import\s+fs\s+from\s+["']node:fs["'];/m.test(src)) {
  src = src.replace(
    /^(#!.*\n)?/,
    `$1import fs from "node:fs";\n`
  );
}

// Ensure execSync import
if (!/^\s*import\s+\{\s*execSync\s*\}\s+from\s+["']node:child_process["'];/m.test(src)) {
  const firstImport = src.match(/^\s*import .*;$/m);
  if (!firstImport || firstImport.index === undefined) {
    throw new Error("Could not locate import section for execSync insertion.");
  }
  src =
    src.slice(0, firstImport.index + firstImport[0].length) +
    `\nimport { execSync } from "node:child_process";` +
    src.slice(firstImport.index + firstImport[0].length);
}

// Find last import
const imports = [...src.matchAll(/^\s*import .*;$/gm)];
if (imports.length === 0) {
  throw new Error("No import lines found; cannot safely insert guard.");
}

const last = imports[imports.length - 1];
if (last.index === undefined) {
  throw new Error("Failed to compute insertion index for idempotency guard.");
}

const insertAt = last.index + last[0].length;

const guard = `

/**
 * IDEMPOTENCY_GUARD_SENTINEL_CORE_EXISTS
 * If sentinel-core already exists, do NOT rewrite any files.
 * Only rebuild and exit.
 */
{
  const pkgJson = "packages/sentinel-core/package.json";
  if (fs.existsSync(pkgJson)) {
    console.log("OK: packages/sentinel-core already exists (no rewrite).");
    execSync("npm -w @chc/sentinel-core run build", { stdio: "inherit" });
    execSync("npm run build", { stdio: "inherit" });
    process.exit(0);
  }
}
`;

src = src.slice(0, insertAt) + guard + src.slice(insertAt);

fs.writeFileSync(TARGET, src);
console.log("Patched: v3 now skips rewrites when sentinel-core already exists.");

run("npm run build");
