#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/errors.ts";
let src = fs.readFileSync(FILE, "utf8");

const CODES = [
  "INVALID_SCOPE_NAMESPACE",
  "ACTION_SCOPE_NOT_ALLOWED",
];

function ensureCode(code) {
  if (src.includes(`"${code}"`)) return false;

  // Find the union declaration block:
  // export type CHCOpsErrorCode =
  //   | "..."
  //   | "...";
  const m = src.match(/export type CHCOpsErrorCode\s*=\s*([\s\S]*?);/m);
  if (!m) {
    console.error("ERROR: Could not locate CHCOpsErrorCode union in src/errors.ts");
    process.exit(1);
  }

  const full = m[0];
  const body = m[1];

  // Append as a new union member BEFORE the semicolon
  const nextFull = full.replace(body, `${body}\n  | "${code}"`);
  src = src.replace(full, nextFull);
  return true;
}

let changed = false;
for (const c of CODES) changed = ensureCode(c) || changed;

fs.writeFileSync(FILE, src);
console.log(changed ? "Patched: extended CHCOpsErrorCode union." : "OK: error codes already present (no-op).");
