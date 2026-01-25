#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

/**
 * Replace illegal function declaration inside class
 * function authorize(  -> authorize(
 */
const rx = /(^|\n)\s*function\s+authorize\s*\(/m;

if (!rx.test(src)) {
  console.log("OK: no stray function authorize() found (no-op).");
} else {
  src = src.replace(rx, "\n  authorize(");
  console.log("Patched: converted function authorize() to class method.");
}

fs.writeFileSync(FILE, src);

/**
 * Final gate
 */
execSync("npm run build", { stdio: "inherit" });
