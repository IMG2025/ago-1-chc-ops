#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const SRC = path.join(ROOT, "src");
const PKG = path.join(ROOT, "packages", "sentinel-core");
const PKG_SRC = path.join(PKG, "src");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readText(p) {
  return fs.readFileSync(p, "utf8");
}

function writeText(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s);
}

function copyAndNormalize(from, to) {
  if (!fs.existsSync(from)) {
    console.error(`ERROR: Missing source file: ${path.relative(ROOT, from)}`);
    process.exit(1);
  }
  let content = readText(from);

  // Normalize line endings + ensure newline at EOF
  content = content.replace(/\r\n/g, "\n");
  if (!content.endsWith("\n")) content += "\n";

  // Guardrail: do NOT rewrite imports to '@chc/sentinel-core' here.
  // We only ensure intra-package relative imports remain valid under the same layout.
  // (This is copy-only phase.)
  writeText(to, content);
}

function copyTree(srcDir, dstDir) {
  ensureDir(dstDir);
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, ent.name);
    const d = path.join(dstDir, ent.name);
    if (ent.isDirectory()) copyTree(s, d);
    else if (ent.isFile()) copyAndNormalize(s, d);
  }
}

ensureDir(PKG_SRC);

// 1) Copy top-level core modules (copy-only, no deletions)
const TOP = [
  "errors.ts",
  "registry.ts",
  "authorize.ts",
  "executors.ts",
  "plugin.ts",
  "index.ts",
  "diagnostics/listDomains.ts",
];

for (const rel of TOP) {
  const from = path.join(SRC, rel);
  const to = path.join(PKG_SRC, rel);
  copyAndNormalize(from, to);
}

// 2) Copy contracts subtree if present
const CONTRACTS_SRC = path.join(SRC, "contracts");
if (fs.existsSync(CONTRACTS_SRC) && fs.statSync(CONTRACTS_SRC).isDirectory()) {
  copyTree(CONTRACTS_SRC, path.join(PKG_SRC, "contracts"));
}

// 3) Overwrite sentinel-core public barrel (explicit, stable API surface)
writeText(
  path.join(PKG_SRC, "index.ts"),
  `// @chc/sentinel-core public surface (generated)
// NOTE: copy-only phase; chc-ops still imports locally until cutover.

export * from "./errors.js";
export * from "./registry.js";
export * from "./authorize.js";

export * from "./contracts/index.js";
export * from "./contracts/executor.js";
export * from "./contracts/registry.js";
export * from "./contracts/plugin.js";
`
);

// 4) Build sentinel-core first (fast feedback), then final gate root build
run("npm -w @chc/sentinel-core run build");
run("npm run build");
