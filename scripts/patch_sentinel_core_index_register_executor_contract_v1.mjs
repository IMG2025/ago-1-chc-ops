#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "packages/sentinel-core/src/index.ts";
let src = fs.readFileSync(FILE, "utf8");

// 1) Ensure we have a *local* import of registerExecutor (not just re-export)
const importLine = `import { registerExecutor } from "./plugin.js";`;
if (!src.includes(importLine)) {
  // Insert after shebang/first comment block or at top
  src = importLine + "\n" + src;
}

// 2) Ensure we export registerExecutor as part of public surface
const exportValueRe = /export\s*\{\s*[^}]*\bregisterExecutor\b[^}]*\}\s*;/m;
if (!exportValueRe.test(src)) {
  // If there's an export { ... } block, append into the first one; else add a new one.
  const anyExportBlock = src.match(/export\s*\{\s*[^}]*\}\s*;/m);
  if (anyExportBlock) {
    const block = anyExportBlock[0];
    // Add registerExecutor if missing
    const inner = block.replace(/^export\s*\{|\}\s*;$/g, "").trim();
    const parts = inner ? inner.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (!parts.includes("registerExecutor")) parts.push("registerExecutor");
    const nextBlock = `export { ${parts.join(", ")} };`;
    src = src.replace(block, nextBlock);
  } else {
    src = src.trimEnd() + "\n\nexport { registerExecutor };\n";
  }
}

// 3) Ensure the type is derived from the *local* value symbol
const typeLine =
`/**
 * Canonical public executor registration function type.
 * Derived from registerExecutor to prevent drift.
 */
export type RegisterExecutorFn = typeof registerExecutor;
`;

if (!src.includes("export type RegisterExecutorFn")) {
  src = src.trimEnd() + "\n\n" + typeLine;
} else {
  // Canonicalize: keep only one definition
  // Remove all existing RegisterExecutorFn type blocks, then append canonical one once.
  src = src.replace(/\/\*\*[\s\S]*?\*\/\s*export\s+type\s+RegisterExecutorFn\s*=[\s\S]*?;\s*/g, "");
  src = src.replace(/export\s+type\s+RegisterExecutorFn\s*=[\s\S]*?;\s*/g, "");
  src = src.trimEnd() + "\n\n" + typeLine;
}

// 4) Write back
fs.writeFileSync(FILE, src.trimEnd() + "\n");
console.log("OK: sentinel-core index.ts now exports registerExecutor and RegisterExecutorFn (canonical).");

// 5) Build gates (workspace + root)
execSync("npm -w @chc/sentinel-core run build", { stdio: "inherit" });
execSync("npm run build", { stdio: "inherit" });

// 6) Proof: show whether dist exports exist
const dts = "packages/sentinel-core/dist/index.d.ts";
if (fs.existsSync(dts)) {
  const out = fs.readFileSync(dts, "utf8");
  const ok = out.includes("RegisterExecutorFn");
  console.log(`OK: dist/index.d.ts contains RegisterExecutorFn = ${ok}`);
} else {
  console.log("WARN: dist/index.d.ts not found after build.");
}
