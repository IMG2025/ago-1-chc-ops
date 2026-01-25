#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/executors.ts";
let src = fs.readFileSync(FILE, "utf8");

const BEFORE = /TARIFF_SYNC:\s*\[[^\]]+\]/g;
const AFTER  = `TARIFF_SYNC: ["hospitality:execute"]`;

if (!BEFORE.test(src)) {
  console.log("OK: TARIFF_SYNC already aligned to execute (no-op).");
  process.exit(0);
}

src = src.replace(BEFORE, AFTER);
fs.writeFileSync(FILE, src);

console.log("Patched: TARIFF_SYNC now uses hospitality:execute.");
