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

// Anchor on PASS tool invocation (must exist)
const PASS_TOOL_ANCHOR = "tool: ";
const PASS_EXPECT_200 = "expected: 200";

if (!src.includes(PASS_EXPECT_200)) {
  throw new Error("Unsafe: PASS case (expected 200) not found in smoke");
}

// If ctx.contractVersion already present, do nothing
if (src.includes("contractVersion")) {
  console.log("No changes needed: ctx.contractVersion already present");
} else {
  src = src.replace(
    PASS_EXPECT_200,
    `ctx: { contractVersion: "21A.1.0" },\n  ${PASS_EXPECT_200}`
  );
}

writeIfChanged(SMOKE, src);

console.log("✔ Phase 21C smoke PASS ctx.contractVersion enforced");

console.log("== Running build (required gate) ==");
run("npm run build");
