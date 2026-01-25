#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/executors.ts";
let src = fs.readFileSync(FILE, "utf8");

const BEFORE = /RATE_UPDATE:\s*\[[^\]]+\]/g;
const AFTER  = `RATE_UPDATE: ["hospitality:execute"]`;

if (!BEFORE.test(src)) {
  console.log("OK: RATE_UPDATE already aligned to execute (no-op).");
  process.exit(0);
}

src = src.replace(BEFORE, AFTER);
fs.writeFileSync(FILE, src);

console.log("Patched: RATE_UPDATE now uses hospitality:execute.");
