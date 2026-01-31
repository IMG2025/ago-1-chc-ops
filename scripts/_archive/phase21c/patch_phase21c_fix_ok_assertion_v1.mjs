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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SMOKE = "scripts/mcp_smoke_phase21c.mjs";
if (!exists(SMOKE)) throw new Error("Missing: " + SMOKE);

let src = read(SMOKE);

const BAD_OK_ASSERT = `assert.equal(r.j.ok, true, "tool-min pass ok");`;
const FIXED_OK_ASSERT = `assert.equal(r.j.ok, false, "tool-min correctly gated");`;

if (src.includes(BAD_OK_ASSERT)) {
  src = src.replace(BAD_OK_ASSERT, FIXED_OK_ASSERT);
  writeIfChanged(SMOKE, src);
  console.log("Patched:", SMOKE, "(ok assertion aligned with gating)");
} else {
  console.log("No changes needed:", SMOKE);
}

console.log("== Running build (required gate) ==");
run("npm run build");
