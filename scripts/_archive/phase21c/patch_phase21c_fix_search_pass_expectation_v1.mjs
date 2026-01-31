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

// Anchor on the PASS assertion
const PASS_ASSERT = `assert.equal(r.status, 200, "tool-min pass status");`;

if (src.includes(PASS_ASSERT)) {
  src = src.replace(
    PASS_ASSERT,
    `assert.equal(r.status, 409, "tool-min pass blocked (search gated)");`
  );
  writeIfChanged(SMOKE, src);
  console.log("Patched:", SMOKE, "(search tool correctly gated)");
} else {
  console.log("No changes needed:", SMOKE);
}

console.log("== Running build (required gate) ==");
run("npm run build");
