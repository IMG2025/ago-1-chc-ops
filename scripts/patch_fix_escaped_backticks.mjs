#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const target = "scripts/patch_sentinel_mount_accepts_registry.mjs";
if (!fs.existsSync(target)) throw new Error(`Missing: ${target}`);

let src = fs.readFileSync(target, "utf8");

// No-op if nothing to fix
if (!src.includes("\\`")) {
  console.log("OK: no escaped backticks found (no-op).");
  run("npm run build");
  process.exit(0);
}

src = src.replaceAll("\\`", "`");

fs.writeFileSync(target, src);
console.log("Patched: removed escaped backticks from patch script.");

run("npm run build");
