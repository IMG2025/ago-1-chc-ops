#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/executors.ts";
let src = fs.readFileSync(FILE, "utf8");

// Replace the entire VENDOR_INVOICE_CHECK scope array with ["hospitality:execute"]
const BEFORE = /VENDOR_INVOICE_CHECK:\s*\[[^\]]+\]/g;
const AFTER  = `VENDOR_INVOICE_CHECK: ["hospitality:execute"]`;

if (!BEFORE.test(src)) {
  console.log("OK: VENDOR_INVOICE_CHECK already aligned to execute (no-op).");
  process.exit(0);
}

src = src.replace(BEFORE, AFTER);
fs.writeFileSync(FILE, src);

console.log("Patched: VENDOR_INVOICE_CHECK now uses hospitality:execute.");
