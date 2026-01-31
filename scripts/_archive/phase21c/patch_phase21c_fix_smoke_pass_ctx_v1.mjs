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
if (!fs.existsSync(SMOKE)) throw new Error("Missing smoke21c script");

let src = read(SMOKE);

/*
 * Ensure PASS case explicitly sets ctx.contractVersion
 */
const PASS_ANCHOR = "/* PASS: tool-min satisfied */";
if (!src.includes(PASS_ANCHOR)) {
  throw new Error("Unsafe: PASS anchor not found in smoke");
}

const INJECT = `
    ctx: {
      contractVersion: "21A.1.0"
    },
`;

if (!src.includes('contractVersion: "21A.1.0"')) {
  src = src.replace(
    PASS_ANCHOR,
    `${PASS_ANCHOR}\n${INJECT}`
  );
}

writeIfChanged(SMOKE, src);

console.log("✔ Phase 21C smoke PASS ctx.contractVersion enforced");

console.log("== Running build (required gate) ==");
run("npm run build");
