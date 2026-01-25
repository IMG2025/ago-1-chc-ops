#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"
[ -f "$FILE" ] || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
import fs from "fs";

const file = "src/executors.ts";
let s = fs.readFileSync(file, "utf8");

// Locate the ciagExecutorSpec object literal
const nameIdx = s.indexOf("export const ciagExecutorSpec");
if (nameIdx < 0) {
  console.error("ERROR: export const ciagExecutorSpec not found");
  process.exit(1);
}

function findObjectSpan(src, fromIdx) {
  const braceStart = src.indexOf("{", fromIdx);
  if (braceStart < 0) return null;
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (depth === 0) return [braceStart, i];
    }
  }
  return null;
}

const objSpan = findObjectSpan(s, nameIdx);
if (!objSpan) {
  console.error("ERROR: Could not find ciagExecutorSpec object braces");
  process.exit(1);
}

const [obj0, obj1] = objSpan;
let obj = s.slice(obj0, obj1 + 1);

// Find required_scopes object inside ciagExecutorSpec
const rsKeyIdx = obj.indexOf("required_scopes");
if (rsKeyIdx < 0) {
  console.error("ERROR: required_scopes not found inside ciagExecutorSpec");
  process.exit(1);
}
const rsSpan = findObjectSpan(obj, rsKeyIdx);
if (!rsSpan) {
  console.error("ERROR: Could not find required_scopes object braces");
  process.exit(1);
}
const [rs0, rs1] = rsSpan;
let rs = obj.slice(rs0, rs1 + 1);

// Already correct? (idempotent no-op)
const desired = `ESCALATE: ["ciag:escalate"]`;
const hasEscKey = /(^|\n)\s*ESCALATE\s*:/.test(rs);
const hasDesired = /ESCALATE\s*:\s*\[\s*["']ciag:escalate["']\s*\]/.test(rs);

if (hasDesired) {
  console.log("ciagExecutorSpec.required_scopes.ESCALATE already set (no-op).");
} else {
  if (hasEscKey) {
    // Normalize existing ESCALATE entry
    rs = rs.replace(/(\bESCALATE\s*:\s*)(\[[^\]]*\]|"[^"]*"|'[^']*'|[^,\n}]*)/m, `$1["ciag:escalate"]`);
  } else {
    // Insert ESCALATE entry before closing brace with stable indentation
    rs = rs.replace(/\n(\s*)\}\s*$/, (m, indent) => `\n${indent}${desired},\n${indent}}`);
    // Fallback for single-line object
    if (!rs.includes("ESCALATE:")) {
      rs = rs.slice(0, -1) + `, ${desired} }`;
    }
  }

  const nextObj = obj.slice(0, rs0) + rs + obj.slice(rs1 + 1);
  const out = s.slice(0, obj0) + nextObj + s.slice(obj1 + 1);
  fs.writeFileSync(file, out);
  console.log("Patched ciagExecutorSpec.required_scopes to include ESCALATE.");
}
NODE

npm run build
