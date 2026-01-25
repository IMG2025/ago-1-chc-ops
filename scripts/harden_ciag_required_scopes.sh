#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"

if [[ ! -f "$FILE" ]]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

node - <<'NODE'
import fs from "fs";

const file = "src/executors.ts";
let s = fs.readFileSync(file, "utf8");

// Extract the ciagExecutorSpec object block (best-effort, non-destructive)
const re = /export\s+const\s+ciagExecutorSpec\s*:\s*ExecutorSpec\s*=\s*\{([\s\S]*?)\n\};/m;
const m = s.match(re);
if (!m) throw new Error("ciagExecutorSpec block not found in src/executors.ts");

let block = m[0];

// Ensure required_scopes exists; if missing, add a conservative default block near supported_task_types
if (!/\brequired_scopes\s*:/.test(block)) {
  // Insert after supported_task_types if present, else after executor_id
  if (/\bsupported_task_types\s*:/.test(block)) {
    block = block.replace(
      /(\bsupported_task_types\s*:\s*[^,]+,\s*)/m,
      `$1  required_scopes: {\n    EXECUTE: ["ciag:execute"],\n    ANALYZE: ["ciag:analyze"],\n    ESCALATE: ["ciag:escalate"],\n  },\n`
    );
  } else if (/\bexecutor_id\s*:/.test(block)) {
    block = block.replace(
      /(\bexecutor_id\s*:\s*[^,]+,\s*)/m,
      `$1  required_scopes: {\n    EXECUTE: ["ciag:execute"],\n    ANALYZE: ["ciag:analyze"],\n    ESCALATE: ["ciag:escalate"],\n  },\n`
    );
  } else {
    // Fallback: add at top of object
    block = block.replace(
      /export\s+const\s+ciagExecutorSpec\s*:\s*ExecutorSpec\s*=\s*\{\s*/m,
      (mm) => mm + `required_scopes: {\n    EXECUTE: ["ciag:execute"],\n    ANALYZE: ["ciag:analyze"],\n    ESCALATE: ["ciag:escalate"],\n  },\n  `
    );
  }
} else {
  // required_scopes exists; ensure keys exist (insert if missing)
  block = block.replace(
    /required_scopes\s*:\s*\{([\s\S]*?)\n\s*\}/m,
    (mm, inner) => {
      let next = inner;

      const ensure = (k, v) => {
        const keyRe = new RegExp(`\\b${k}\\s*:`);
        if (keyRe.test(next)) return;
        next = `${next}\n    ${k}: ["${v}"],`;
      };

      ensure("EXECUTE", "ciag:execute");
      ensure("ANALYZE", "ciag:analyze");
      ensure("ESCALATE", "ciag:escalate");

      // Keep formatting stable
      next = next.replace(/\n{3,}/g, "\n\n");
      return `required_scopes: {${next}\n  }`;
    }
  );
}

if (block === m[0]) {
  console.log("CIAG required_scopes already satisfied (no-op).");
} else {
  s = s.replace(m[0], block);
  fs.writeFileSync(file, s);
  console.log("CIAG required_scopes hardened in src/executors.ts");
}
NODE

npm run build
