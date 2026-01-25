#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

if (!src.includes("chOpsError(")) {
  console.log("OK: no chOpsError symbol present (no-op).");
  process.exit(0);
}

src = src.replace(/\bchOpsError\s*\(/g, "chcOpsError(");

fs.writeFileSync(FILE, src);
console.log("Patched: corrected chOpsError -> chcOpsError.");
