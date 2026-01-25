#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/registry.ts";
let s = fs.readFileSync(file, "utf8");

// 1) Remove any *top-level* authorize(...) method block (the stray one after createRegistry)
//    We target the exact JSDoc + authorize block you showed.
const strayBlockRe =
/\/\*\*[\s\S]*?Sentinel-aligned gate:[\s\S]*?\*\/\s*\n\s*authorize\s*\([\s\S]*?\)\s*:\s*void\s*\{\n[\s\S]*?\n\s*\}\s*\n/g;

const beforeRemove = s;
s = s.replace(strayBlockRe, "");
const removedStray = s !== beforeRemove;

// 2) Ensure authorize(...) exists *inside* export class DomainRegistry { ... }
//    If already present, do nothing.
const hasAuthorizeInClass =
/export class DomainRegistry\s*\{[\s\S]*?\n\s*authorize\s*\(/.test(s);

if (!hasAuthorizeInClass) {
  // Insert authorize method before the closing brace of DomainRegistry class.
  // We match the class block and inject just before the final "\n}" that closes it.
  const classRe = /(export class DomainRegistry\s*\{[\s\S]*?\n\})/m;
  const m = s.match(classRe);
  if (!m) {
    throw new Error("Could not find 'export class DomainRegistry { ... }' block");
  }

  const classBlock = m[1];

  const authorizeMethod = `
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

  // Insert before the last newline + closing brace of the class block.
  const patchedClass = classBlock.replace(/\n\}\s*$/m, `${authorizeMethod}\n}\n`);
  s = s.replace(classBlock, patchedClass);
}

fs.writeFileSync(file, s);
console.log(
  [
    "Registry authorize placement fixed:",
    removedStray ? "removed stray top-level authorize block" : "no stray block found",
    hasAuthorizeInClass ? "authorize already in class (no-op)" : "inserted authorize into class",
  ].join(" | ")
);
NODE

npm run build
