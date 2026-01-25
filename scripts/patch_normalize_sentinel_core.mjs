#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const CORE = path.join(ROOT, "packages", "sentinel-core", "src");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

/* 1) Fix relative imports to include .js */
for (const file of walk(CORE)) {
  if (!file.endsWith(".ts")) continue;
  let src = fs.readFileSync(file, "utf8");

  src = src.replace(
    /(from\s+["']\.\/[^"']+?)(["'])/g,
    (m, p1, p2) => p1.endsWith(".js") ? m : `${p1}.js${p2}`
  );

  src = src.replace(
    /(from\s+["']\.\.\/[^"']+?)(["'])/g,
    (m, p1, p2) => p1.endsWith(".js") ? m : `${p1}.js${p2}`
  );

  fs.writeFileSync(file, src);
}

/* 2) Fix duplicate barrel exports */
const indexPath = path.join(CORE, "index.ts");
if (fs.existsSync(indexPath)) {
  let index = fs.readFileSync(indexPath, "utf8");

  index = index
    .split("\n")
    .filter(l => !l.includes('export * from "./contracts/index.js"'))
    .join("\n")
    .trim() + "\n";

  fs.writeFileSync(indexPath, index);
}

/* 3) Build sentinel-core, then full build */
run("npm -w @chc/sentinel-core run build");
run("npm run build");
