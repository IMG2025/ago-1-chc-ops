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

/**
 * Anchor: Phase 21B equality enforcement
 * We replace strict equality with window validation only.
 */
const STRICT_EQ = /if\s*\(\s*ctx\.contractVersion\s*!==\s*capabilities\.contractVersion\s*\)\s*\{/;

if (STRICT_EQ.test(src)) {
  src = src.replace(
    STRICT_EQ,
    `if (
      compareVersions(ctx.contractVersion, capabilities.minSupportedContractVersion) < 0 ||
      compareVersions(ctx.contractVersion, capabilities.contractVersion) > 0
    ) {`
  );
  writeIfChanged(SERVER, src);
  console.log("Patched:", SERVER, "(global contract gate relaxed to window)");
} else if (src.includes("minSupportedContractVersion")) {
  console.log("No changes needed:", SERVER, "(already window-based)");
} else {
  throw new Error("Unsafe: expected strict contractVersion equality gate not found.");
}

chmod755("scripts/patch_phase21c_relax_global_contract_gate_v1.mjs");

console.log("== Syntax check (required gate) ==");
run(`node --check ${SERVER}`);

console.log("== Running build (required gate) ==");
run("npm run build");
