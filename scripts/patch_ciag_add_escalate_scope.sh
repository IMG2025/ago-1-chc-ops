#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"
[ -f "$FILE" ] || { echo "ERROR: $FILE not found"; exit 1; }

node - <<'NODE'
import fs from "fs";

const file = "src/executors.ts";
let s = fs.readFileSync(file, "utf8");

const start = s.indexOf("export const ciagExecutorSpec");
if (start < 0) {
  console.error("ERROR: ciagExecutorSpec not found");
  process.exit(1);
}

function findBalanced(src, fromIdx) {
  const open = src.indexOf("{", fromIdx);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return [open, i];
    }
  }
  return null;
}

const ciagObjSpan = findBalanced(s, start);
if (!ciagObjSpan) {
  console.error("ERROR: could not locate ciagExecutorSpec object");
  process.exit(1);
}
const [obj0, obj1] = ciagObjSpan;
let obj = s.slice(obj0, obj1 + 1);

const rsKey = obj.indexOf("required_scopes");
if (rsKey < 0) {
  console.error("ERROR: required_scopes not found inside ciagExecutorSpec");
  process.exit(1);
}

const rsSpan = findBalanced(obj, rsKey);
if (!rsSpan) {
  console.error("ERROR: could not locate required_scopes object");
  process.exit(1);
}
const [rs0, rs1] = rsSpan;
let rs = obj.slice(rs0, rs1 + 1);

// Idempotent: if already has ESCALATE with ciag:escalate, no-op
const hasDesired = /ESCALATE\s*:\s*\[\s*["']ciag:escalate["']\s*\]/.test(rs);
if (hasDesired) {
  console.log("CIAG ESCALATE scope already present (no-op).");
  process.exit(0);
}

// If ESCALATE exists but wrong, normalize it
if (/(^|\n)\s*ESCALATE\s*:/.test(rs)) {
  rs = rs.replace(
    /(\bESCALATE\s*:\s*)(\[[^\]]*\]|"[^"]*"|'[^']*'|[^,\n}]*)/m,
    `$1["ciag:escalate"]`
  );
} else {
  // Insert before closing brace; preserve indentation
  rs = rs.replace(/\n(\s*)\}\s*$/, (m, indent) => `\n${indent}ESCALATE: ["ciag:escalate"],\n${indent}}`);
  // Fallback if single-line
  if (!rs.includes("ESCALATE")) {
    rs = rs.slice(0, -1) + `, ESCALATE: ["ciag:escalate"] }`;
  }
}

const nextObj = obj.slice(0, rs0) + rs + obj.slice(rs1 + 1);
const out = s.slice(0, obj0) + nextObj + s.slice(obj1 + 1);

fs.writeFileSync(file, out);
console.log("Patched ciagExecutorSpec.required_scopes to include ESCALATE.");
NODE

npm run build
