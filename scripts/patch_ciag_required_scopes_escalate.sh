#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"
if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

node - <<'NODE'
import fs from "fs";

const file = "src/executors.ts";
let s = fs.readFileSync(file, "utf8");

const anchor = "ciagExecutorSpec";
const idx = s.indexOf(anchor);
if (idx < 0) {
  console.error("ERROR: ciagExecutorSpec not found in src/executors.ts");
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

const span = findObjectSpan(s, idx);
if (!span) {
  console.error("ERROR: Unable to locate ciagExecutorSpec object literal span");
  process.exit(1);
}
const [objStart, objEnd] = span;
let obj = s.slice(objStart, objEnd + 1);

// Find required_scopes object inside ciagExecutorSpec
const rsIdx = obj.indexOf("required_scopes");
if (rsIdx < 0) {
  console.error("ERROR: required_scopes not found in ciagExecutorSpec");
  process.exit(1);
}
const rsSpan = findObjectSpan(obj, rsIdx);
if (!rsSpan) {
  console.error("ERROR: Unable to locate required_scopes object literal");
  process.exit(1);
}
const [rs0, rs1] = rsSpan;
let rs = obj.slice(rs0, rs1 + 1);

// If ESCALATE missing, add it. If present, normalize it.
const hasEsc = /(^|\n)\s*ESCALATE\s*:/.test(rs);
if (!hasEsc) {
  // Insert before closing brace in a stable way
  if (rs.includes("\n")) {
    rs = rs.replace(/\n(\s*)\}\s*$/, (m, indent) => `\n${indent}ESCALATE: ["ciag:escalate"],\n${indent}}`);
  } else {
    rs = rs.slice(0, -1) + `, ESCALATE: ["ciag:escalate"] }`;
  }
} else {
  rs = rs.replace(/(\bESCALATE\s*:\s*)(\[[^\]]*\]|"[^"]*"|[^,\n}]*)/m, `$1["ciag:escalate"]`);
}

const nextObj = obj.slice(0, rs0) + rs + obj.slice(rs1 + 1);
const out = s.slice(0, objStart) + nextObj + s.slice(objEnd + 1);

if (out === s) {
  console.log("CIAG required_scopes already includes ESCALATE (no-op).");
} else {
  fs.writeFileSync(file, out);
  console.log("Patched CIAG required_scopes to include ESCALATE in src/executors.ts");
}
NODE

npm run build
