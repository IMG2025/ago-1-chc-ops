#!/usr/bin/env bash
set -euo pipefail

# Find the file containing ciagExecutorSpec
FILE="$(grep -R "ciagExecutorSpec" -n src | head -n 1 | cut -d: -f1)"

if [ -z "$FILE" ]; then
  echo "ERROR: ciagExecutorSpec not found in src/"
  exit 1
fi

node - <<'NODE'
import fs from "fs";

const file = process.env.FILE;
let s = fs.readFileSync(file, "utf8");

function findBlock(src, anchor) {
  const a = src.indexOf(anchor);
  if (a < 0) return null;
  return a;
}

function findObjectLiteralSpan(src, keyIdx) {
  const braceStart = src.indexOf("{", keyIdx);
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

function findArraySpan(src, keyIdx) {
  const bracketStart = src.indexOf("[", keyIdx);
  if (bracketStart < 0) return null;
  let depth = 0;
  for (let i = bracketStart; i < src.length; i++) {
    const c = src[i];
    if (c === "[") depth++;
    if (c === "]") {
      depth--;
      if (depth === 0) return [bracketStart, i];
    }
  }
  return null;
}

// Narrow to the ciagExecutorSpec object to avoid collateral edits.
const ciagIdx = s.indexOf("ciagExecutorSpec");
if (ciagIdx < 0) {
  console.error("ERROR: ciagExecutorSpec anchor not found");
  process.exit(1);
}

const ciagObjSpan = findObjectLiteralSpan(s, ciagIdx);
if (!ciagObjSpan) {
  console.error("ERROR: Unable to locate ciagExecutorSpec object literal");
  process.exit(1);
}

const [ciagStart, ciagEnd] = ciagObjSpan;
let ciagObj = s.slice(ciagStart, ciagEnd + 1);

// 1) Ensure supported_task_types includes "ESCALATE"
const sttKey = ciagObj.indexOf("supported_task_types");
if (sttKey < 0) {
  console.error("ERROR: supported_task_types not found inside ciagExecutorSpec");
  process.exit(1);
}
const sttSpan = findArraySpan(ciagObj, sttKey);
if (!sttSpan) {
  console.error("ERROR: Unable to locate supported_task_types array");
  process.exit(1);
}
let [sttA, sttB] = sttSpan;
let sttArr = ciagObj.slice(sttA, sttB + 1);

if (!sttArr.includes('"ESCALATE"')) {
  // Insert before closing ]
  const insert = sttArr.endsWith("]") ? sttArr.slice(0, -1) + (sttArr.includes('"') ? ', "ESCALATE"]' : '"ESCALATE"]') : sttArr;
  // Normalize comma placement for typical formatting
  let fixed = sttArr.slice(0, -1);
  fixed = fixed.trimEnd();
  if (!fixed.endsWith("[")) fixed += ",";
  fixed += ' "ESCALATE" ]';
  // Preserve original bracket positioning style (inline vs multiline)
  // If multiline, we insert with newline indentation.
  if (sttArr.includes("\n")) {
    fixed = sttArr.replace(/\]\s*$/, (m) => {
      const indent = (sttArr.match(/\n(\s*)\]/) || ["", "  "])[1];
      return `,\n${indent}"ESCALATE"\n${indent.slice(0, Math.max(0, indent.length - 2))}]`;
    });
    // If the regex didn’t match, fallback to simple insertion
    if (!fixed.includes('"ESCALATE"')) fixed = sttArr.slice(0, -1) + ',\n    "ESCALATE"\n  ]';
  }
  ciagObj = ciagObj.slice(0, sttA) + fixed + ciagObj.slice(sttB + 1);
}

// 2) Ensure required_scopes.ESCALATE includes "ciag:escalate"
const rsKey = ciagObj.indexOf("required_scopes");
if (rsKey < 0) {
  console.error("ERROR: required_scopes not found inside ciagExecutorSpec");
  process.exit(1);
}
const rsSpan = findObjectLiteralSpan(ciagObj, rsKey);
if (!rsSpan) {
  console.error("ERROR: Unable to locate required_scopes object");
  process.exit(1);
}
let [rsA, rsB] = rsSpan;
let rsObj = ciagObj.slice(rsA, rsB + 1);

const hasEscKey = /(^|\n)\s*ESCALATE\s*:/m.test(rsObj);
if (!hasEscKey) {
  // Insert before closing brace
  const insertion = rsObj.includes("\n")
    ? rsObj.replace(/\}\s*$/, `  ESCALATE: ["ciag:escalate"],\n}`)
    : rsObj.slice(0, -1) + `, ESCALATE: ["ciag:escalate"] }`;
  rsObj = insertion;
} else {
  // Ensure it contains the scope
  if (!rsObj.includes("ciag:escalate")) {
    // Replace ESCALATE value with ["ciag:escalate"] (authoritative)
    rsObj = rsObj.replace(/(\bESCALATE\s*:\s*)(\[[^\]]*\]|"[^"]*"|[^,\n}]*)/m, `$1["ciag:escalate"]`);
  }
}

ciagObj = ciagObj.slice(0, rsA) + rsObj + ciagObj.slice(rsB + 1);

// Recompose full file
const out = s.slice(0, ciagStart) + ciagObj + s.slice(ciagEnd + 1);

if (out === s) {
  console.log(`CIAG ESCALATE scope already satisfied (no-op) in ${file}`);
} else {
  fs.writeFileSync(file, out);
  console.log(`Patched CIAG to include ESCALATE required scope in ${file}`);
}
NODE

npm run build
