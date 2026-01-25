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
function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

// ------------------------------
// 1) Scrub unsupported "workspace:*" protocol across all package.json files
// ------------------------------
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".turbo", ".next"]);
const scrubbed = [];

function scrubWorkspaceProtocol(obj) {
  if (!obj || typeof obj !== "object") return false;
  let changed = false;

  const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  for (const f of fields) {
    const deps = obj[f];
    if (!deps || typeof deps !== "object") continue;
    for (const [k, v] of Object.entries(deps)) {
      if (typeof v === "string" && v.startsWith("workspace:")) {
        // Termux npm doesn't support workspace:* protocol. Replace with "*".
        deps[k] = "*";
        changed = true;
      }
    }
  }
  return changed;
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name));
      continue;
    }
    if (ent.isFile() && ent.name === "package.json") {
      const p = path.join(dir, ent.name);
      const raw = read(p);
      let obj;
      try { obj = JSON.parse(raw); } catch { continue; }
      const changed = scrubWorkspaceProtocol(obj);
      if (changed) {
        writeIfChanged(p, JSON.stringify(obj, null, 2) + "\n");
        scrubbed.push(p);
      }
    }
  }
}

walk(ROOT);

if (scrubbed.length) {
  console.log(`OK: scrubbed workspace:* protocol in ${scrubbed.length} package.json file(s).`);
} else {
  console.log("OK: no workspace:* protocol found in package.json files (already clean).");
}

// NOTE: We intentionally do NOT run `npm install` here because it has been failing under Termux.
// Once the repo is scrubbed, installs can be attempted again if needed.

// ------------------------------
// 2) Ensure sentinel-core can resolve @chc/nexus-core at type-check time without node_modules
//    by adding TS paths mapping.
// ------------------------------
const sentinelTsconfig = "packages/sentinel-core/tsconfig.json";
if (!fs.existsSync(sentinelTsconfig)) throw new Error(`Missing: ${sentinelTsconfig}`);

const tsObj = JSON.parse(read(sentinelTsconfig));
tsObj.compilerOptions ??= {};
const co = tsObj.compilerOptions;

// Ensure baseUrl exists (required for paths)
if (!co.baseUrl) co.baseUrl = ".";

co.paths ??= {};
// Map package import to local source entrypoint (keeps contract import, no deep import usage in code)
if (!co.paths["@chc/nexus-core"]) co.paths["@chc/nexus-core"] = ["../nexus-core/src/index.ts"];
if (!co.paths["@chc/nexus-core/*"]) co.paths["@chc/nexus-core/*"] = ["../nexus-core/src/*"];

writeIfChanged(sentinelTsconfig, JSON.stringify(tsObj, null, 2) + "\n");
console.log("OK: sentinel-core tsconfig paths set for @chc/nexus-core (Termux-safe resolution).");

// ------------------------------
// 3) Re-run Step 8 lock script and prove gates
// ------------------------------
run("node scripts/patch_step_8_lock_policy_execution_binding_v1.mjs");
run("node scripts/patch_step_8_lock_policy_execution_binding_v1.mjs");

// Compile both packages
run("npm -w @chc/nexus-core run build");
run("npm -w @chc/sentinel-core run build");

// Full repo gates (must end with npm run build)
run("npm test");
run("npm run build");

console.log("OK: Step 8 recovered (workspace protocol scrubbed, TS paths wired, gates green).");
