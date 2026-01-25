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

function findArraySpan(src, fromIdx) {
  const bracketStart = src.indexOf("[", fromIdx);
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

const span = findObjectSpan(s, idx);
if (!span) {
  console.error("ERROR: Unable to locate ciagExecutorSpec object literal");
  process.exit(1);
}
const [objStart, objEnd] = span;
let obj = s.slice(objStart, objEnd + 1);

// Ensure supported_task_types includes "ESCALATE"
{
  const k = obj.indexOf("supported_task_types");
  if (k < 0) {
    console.error("ERROR: supported_task_types not found in ciagExecutorSpec");
    process.exit(1);
  }
  const aSpan = findArraySpan(obj, k);
  if (!aSpan) {
    console.error("ERROR: Unable to locate supported_task_types array");
    process.exit(1);
  }
  const [a0, a1] = aSpan;
  const arr = obj.slice(a0, a1 + 1);
  if (!arr.includes('"ESCALATE"')) {
    if (arr.includes("\n")) {
      // multiline array: insert before closing ]
      const replaced = arr.replace(/\n(\s*)\]\s*$/, (m, indent) => `,\n${indent}"ESCALATE"\n${indent}]`);
      obj = obj.slice(0, a0) + replaced + obj.slice(a1 + 1);
    } else {
      // inline array
      const replaced = arr.slice(0, -1) + (arr.length > 2 ? `, "ESCALATE"]` : `"ESCALATE"]`);
      obj = obj.slice(0, a0) + replaced + obj.slice(a1 + 1);
    }
  }
}

// Ensure required_scopes.ESCALATE includes "ciag:escalate"
{
  const k = obj.indexOf("required_scopes");
  if (k < 0) {
    console.error("ERROR: required_scopes not found in ciagExecutorSpec");
    process.exit(1);
  }
  const oSpan = findObjectSpan(obj, k);
  if (!oSpan) {
    console.error("ERROR: Unable to locate required_scopes object literal");
    process.exit(1);
  }
  const [r0, r1] = oSpan;
  let rs = obj.slice(r0, r1 + 1);

  const escKeyRe = /(^|\n)\s*ESCALATE\s*:/m;
  if (!escKeyRe.test(rs)) {
    // Insert ESCALATE before closing brace
    if (rs.includes("\n")) {
      rs = rs.replace(/\n(\s*)\}\s*$/, (m, indent) => `\n${indent}ESCALATE: ["ciag:escalate"],\n${indent}}`);
    } else {
      rs = rs.slice(0, -1) + `, ESCALATE: ["ciag:escalate"] }`;
    }
  } else {
    // Overwrite ESCALATE entry to be authoritative + deterministic
    rs = rs.replace(/(\bESCALATE\s*:\s*)(\[[^\]]*\]|"[^"]*"|[^,\n}]*)/m, `$1["ciag:escalate"]`);
  }

  obj = obj.slice(0, r0) + rs + obj.slice(r1 + 1);
}

const out = s.slice(0, objStart) + obj + s.slice(objEnd + 1);

if (out === s) {
  console.log("CIAG ESCALATE scope already present in src/executors.ts (no-op).");
} else {
  fs.writeFileSync(file, out);
  console.log("Patched CIAG to include ESCALATE required scope in src/executors.ts");
}
NODE

npm run build
