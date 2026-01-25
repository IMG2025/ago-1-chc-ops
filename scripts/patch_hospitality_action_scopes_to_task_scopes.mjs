#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/plugins/hospitality.ts";
let src = fs.readFileSync(FILE, "utf8");

const BEFORE = /hospitality:rates:write/g;
const AFTER = "hospitality:execute";

if (!BEFORE.test(src)) {
  console.log("OK: no invalid hospitality action scopes found (no-op).");
  process.exit(0);
}

src = src.replace(BEFORE, AFTER);
fs.writeFileSync(FILE, src);
console.log("Patched: hospitality action scopes aligned to task scopes.");
