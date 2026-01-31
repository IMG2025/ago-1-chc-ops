#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SMOKE = "scripts/mcp_smoke_phase21c.mjs";
if (!fs.existsSync(SMOKE)) {
  throw new Error("Missing scripts/mcp_smoke_phase21c.mjs");
}

let src = read(SMOKE);

// Anchor on PASS semantic: ok === true
const PASS_OK_RE = /(assert\.(strictEqual|equal)\(\s*json\.ok\s*,\s*true\s*\))|(ok:\s*true)/;

if (!PASS_OK_RE.test(src)) {
  throw new Error("Unsafe: PASS semantic (ok === true) not found");
}

// If ctx.contractVersion already present, do nothing
if (src.includes("contractVersion")) {
  console.log("No changes needed: ctx.contractVersion already present");
} else {
  src = src.replace(
    PASS_OK_RE,
    `ctx: { contractVersion: "21A.1.0" },\n\n$&`
  );
}

writeIfChanged(SMOKE, src);

console.log("✔ Phase 21C smoke PASS ctx.contractVersion injected");

console.log("== Running build (required gate) ==");
run("npm run build");
