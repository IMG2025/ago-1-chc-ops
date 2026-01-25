#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const CORE = path.join(ROOT, "packages", "sentinel-core", "src");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function mustRead(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${p}`);
  return fs.readFileSync(p, "utf8");
}

function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

/**
 * 1) Canonicalize sentinel-core/src/index.ts:
 *    - Remove all `export * from "./contracts/...";` lines (ambiguity source)
 *    - Keep/export only top-level stable modules
 */
const indexPath = path.join(CORE, "index.ts");
{
  const src = mustRead(indexPath);
  const lines = src.split("\n");

  const kept = [];
  for (const l of lines) {
    // strip wildcard contract exports (root cause)
    if (/^\s*export\s+\*\s+from\s+["']\.\/contracts\/.+["'];\s*$/.test(l)) continue;
    kept.push(l);
  }

  // Ensure index exports stable modules (idempotent append)
  const mustHave = [
    `export * from "./errors.js";`,
    `export * from "./registry.js";`,
    `export * from "./authorize.js";`,
    `export * from "./plugin.js";`,
  ];

  let body = kept.join("\n").trimEnd();

  for (const stmt of mustHave) {
    if (!new RegExp(stmt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(body)) {
      body += (body.endsWith("\n") || body.length === 0 ? "" : "\n") + stmt + "\n";
    }
  }

  // normalize trailing newline
  body = body.replace(/\s*$/, "\n");
  writeIfChanged(indexPath, body);
}

/**
 * 2) Fix diagnostics/listDomains.ts to import from source modules
 *    - If it imports mountCHCOpsPlugins from "../index.js", change to "../plugin.js"
 *    - Leave other imports alone.
 */
const listDomainsPath = path.join(CORE, "diagnostics", "listDomains.ts");
if (fs.existsSync(listDomainsPath)) {
  let src = mustRead(listDomainsPath);

  // Only rewrite the mount import source if present.
  // Example pattern:
  //   import { mountCHCOpsPlugins } from "../index.js";
  src = src.replace(
    /import\s+\{\s*mountCHCOpsPlugins\s*\}\s+from\s+["']\.\.\/index\.js["'];/g,
    `import { mountCHCOpsPlugins } from "../plugin.js";`
  );

  // Some variants might use ../index (without .js) — normalize too
  src = src.replace(
    /import\s+\{\s*mountCHCOpsPlugins\s*\}\s+from\s+["']\.\.\/index["'];/g,
    `import { mountCHCOpsPlugins } from "../plugin.js";`
  );

  writeIfChanged(listDomainsPath, src);
}

/**
 * 3) Final gates
 */
run("npm -w @chc/sentinel-core run build");
run("npm run build");
