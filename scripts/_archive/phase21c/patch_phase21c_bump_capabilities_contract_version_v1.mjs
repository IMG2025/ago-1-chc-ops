#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SERVER = "services/mcp-shared-server/server.mjs";
if (!exists(SERVER)) throw new Error("Missing: " + SERVER);

let src = read(SERVER);

// We only bump the advertised capabilities contractVersion.
// This is intentionally narrow + idempotent.
const fromRe = /(\bcontractVersion\s*:\s*["'])21A\.1\.0(["'])/g;

if (fromRe.test(src)) {
  src = src.replace(fromRe, `$121C.1.0$2`);
  writeIfChanged(SERVER, src);
  console.log("Patched:", SERVER, "(capabilities contractVersion -> 21C.1.0)");
} else if (/\bcontractVersion\s*:\s*["']21C\.1\.0["']/.test(src)) {
  console.log("No changes needed:", SERVER, "(already 21C.1.0)");
} else {
  // Fail closed: we refuse to guess if the anchor changes.
  throw new Error("Unsafe: expected contractVersion: '21A.1.0' anchor not found in server.mjs");
}

chmod755("scripts/patch_phase21c_bump_capabilities_contract_version_v1.mjs");

console.log("== Syntax check (required gate) ==");
run(`node --check ${SERVER}`);

console.log("== Running build (required gate) ==");
run("npm run build");
