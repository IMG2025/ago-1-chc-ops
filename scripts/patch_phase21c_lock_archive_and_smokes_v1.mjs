#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = sh("git rev-parse --show-toplevel");
process.chdir(ROOT);

// 1) Ensure archive folder + README exist (trackable)
const ARCH = path.join("scripts", "_archive", "phase21c");
mkdirp(ARCH);

const readmePath = path.join(ARCH, "README.md");
const readme = `# Phase 21C Archive

This folder contains Phase 21C exploratory / one-off scripts.
Canonical scripts remain in /scripts root.

Managed by: scripts/patch_phase21c_lock_archive_and_smokes_v1.mjs
`;
writeIfChanged(readmePath, readme);

// 2) Ensure smoke20 includes ctx.contractVersion (required after 21A contract gate)
const SMOKE20 = path.join("scripts", "mcp_smoke_phase20.mjs");
if (!exists(SMOKE20)) throw new Error("Missing: " + SMOKE20);

let s20 = read(SMOKE20);

// If contractVersion already present anywhere, do nothing
if (!s20.includes("contractVersion")) {
  // Insert contractVersion inside ctx block (anchor on traceId)
  const re = /(ctx:\s*\{\s*[\s\S]*?traceId:\s*[^,\n}]+)([\s\S]*?\})/m;
  if (!re.test(s20)) throw new Error("Unsafe: could not find ctx.traceId anchor in smoke20");
  s20 = s20.replace(re, (_m, p1, p2) => `${p1},\n        contractVersion: "21A.1.0"${p2}`);
  writeIfChanged(SMOKE20, s20);
}

// 3) Permissions
chmod755("scripts/patch_phase21c_lock_archive_and_smokes_v1.mjs");
chmod755(SMOKE20);
if (exists(path.join("scripts","mcp_smoke_phase21c.mjs"))) chmod755(path.join("scripts","mcp_smoke_phase21c.mjs"));

console.log("Patched: archive README (if needed)");
console.log("Patched: scripts/mcp_smoke_phase20.mjs (contractVersion if missing)");

// Required gate
console.log("== Running build (required gate) ==");
run("npm run build");
