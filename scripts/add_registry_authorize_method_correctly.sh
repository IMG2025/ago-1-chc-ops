#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/registry.ts";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("export class DomainRegistry")) {
  throw new Error("DomainRegistry class not found");
}

// Ensure import exists
if (!s.includes('from "./authorize.js"')) {
  s = s.replace(
    /(import .*;\n)+/,
    (m) => m + 'import { assertAuthorized } from "./authorize.js";\n'
  );
}

// Do not double-insert
if (s.includes("authorize(domain_id")) {
  console.log("authorize() already present, skipping insert.");
  fs.writeFileSync(file, s);
  process.exit(0);
}

// Insert method before final class closing brace
const marker = "\n}";
const idx = s.lastIndexOf(marker);
if (idx === -1) throw new Error("Could not locate class closing brace");

const method = `
  /**
   * Sentinel-aligned authorization gate.
   * Throws deterministic errors on violation.
   */
  authorize(domain_id: string, task: string, scope: string): void {
    const spec = this.get(domain_id);
    if (!spec) {
      throw new Error(\`UNKNOWN_DOMAIN:\${domain_id}\`);
    }
    assertAuthorized(spec as any, task as any, scope);
  }
`;

s = s.slice(0, idx) + method + s.slice(idx);
fs.writeFileSync(file, s);

console.log("authorize() method inserted correctly into DomainRegistry");
NODE

npm run build
