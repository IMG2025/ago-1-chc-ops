#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found"
  exit 1
fi

# If authorize() already exists, no-op
if grep -q "authorize(" "$FILE"; then
  npm run build
  exit 0
fi

node - <<'NODE'
import fs from "fs";

const file = "src/registry.ts";
let s = fs.readFileSync(file, "utf8");

if (s.includes("authorize(")) {
  console.log("authorize() already present. No-op.");
  process.exit(0);
}

if (!s.includes("export class DomainRegistry")) {
  throw new Error("DomainRegistry class not found; refusing to patch.");
}

if (!s.includes('from "./authorize.js"')) {
  // Add import near top (after existing imports). Conservative: insert after last import line.
  const lines = s.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImport = i;
  }
  const ins = 'import { assertAuthorized } from "./authorize.js";';
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, ins);
  else lines.unshift(ins);
  s = lines.join("\n");
}

const method = `
  /**
   * Sentinel-aligned gate: validates task support + required scope.
   * Deterministic. Throws with stable error codes.
   */
  authorize(domain_id: string, task: any, scope: string): void {
    const spec = this.get(domain_id);
    if (!spec) throw new Error(\`UNKNOWN_DOMAIN:\${domain_id}\`);
    assertAuthorized(spec as any, task as any, scope);
  }
`;

const idx = s.lastIndexOf("}\n");
if (idx < 0) throw new Error("Could not locate class closing brace.");
// Insert method before the last closing brace (assumes registry.ts ends with class close)
s = s.slice(0, idx) + method + "\n" + s.slice(idx);

fs.writeFileSync(file, s);
console.log("Patched src/registry.ts: added authorize(domain_id, task, scope).");
NODE

npm run build
