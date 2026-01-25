#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"
[ -f "$FILE" ] || { echo "ERROR: $FILE not found"; exit 1; }

node <<'NODE'
import fs from "fs";

const file = "src/executors.ts";
let src = fs.readFileSync(file, "utf8");

const anchor = "export const ciagExecutorSpec";
const idx = src.indexOf(anchor);
if (idx < 0) {
  console.error("ciagExecutorSpec not found");
  process.exit(1);
}

function findBlock(s, start) {
  const open = s.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    if (s[i] === "}") {
      depth--;
      if (depth === 0) return [open, i];
    }
  }
  return null;
}

const objSpan = findBlock(src, idx);
if (!objSpan) {
  console.error("Failed to parse ciagExecutorSpec object");
  process.exit(1);
}

let obj = src.slice(objSpan[0], objSpan[1] + 1);

if (!obj.includes("required_scopes")) {
  console.error("ciagExecutorSpec missing required_scopes");
  process.exit(1);
}

if (/ESCALATE\s*:\s*\[\s*["']ciag:escalate["']\s*\]/.test(obj)) {
  console.log("CIAG ESCALATE scope already present (no-op).");
  process.exit(0);
}

obj = obj.replace(
  /required_scopes\s*:\s*\{([\s\S]*?)\}/m,
  (m, inner) => {
    if (/ESCALATE\s*:/.test(inner)) {
      return `required_scopes: {${inner.replace(
        /ESCALATE\s*:\s*\[[^\]]*\]/,
        `ESCALATE: ["ciag:escalate"]`
      )}}`;
    }
    return `required_scopes: {${inner},\n    ESCALATE: ["ciag:escalate"]\n  }`;
  }
);

const out =
  src.slice(0, objSpan[0]) +
  obj +
  src.slice(objSpan[1] + 1);

fs.writeFileSync(file, out);
console.log("Forced CIAG ESCALATE required_scope.");
NODE

npm run build
