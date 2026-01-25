#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/index.ts";
const src = fs.readFileSync(FILE, "utf8");

let next = src;

// 1) Ensure we re-export external register functions without creating unused imports
next = next.replace(
  /^\s*import\s*\{\s*registerHospitality\s*\}\s*from\s*["']hospitality-ago-1["'];\s*$/m,
  `export { registerHospitality } from "hospitality-ago-1";`
);
if (!/export\s*\{\s*registerHospitality\s*\}\s*from\s*["']hospitality-ago-1["']/.test(next)) {
  next = `export { registerHospitality } from "hospitality-ago-1";\n` + next;
}

next = next.replace(
  /^\s*import\s*\{\s*registerCIAG\s*\}\s*from\s*["']ciag-ago-1["'];\s*$/m,
  `export { registerCIAG } from "ciag-ago-1";`
);
if (!/export\s*\{\s*registerCIAG\s*\}\s*from\s*["']ciag-ago-1["']/.test(next)) {
  next = `export { registerCIAG } from "ciag-ago-1";\n` + next;
}

// 2) Ensure local specs are imported for internal mounting
if (!/from\s*["']\.\/executors\.js["']/.test(next)) {
  // Insert after the initial export lines if present, otherwise at top.
  const lines = next.split("\n");
  let insertAt = 0;
  while (insertAt < lines.length && lines[insertAt].startsWith("export {")) insertAt++;
  lines.splice(insertAt, 0, `import { hospitalityExecutorSpec, ciagExecutorSpec } from "./executors.js";`);
  next = lines.join("\n");
}

// 3) Replace mount wiring to register local specs (canonical) instead of calling external register* functions
// Hospitality
next = next.replace(
  /registerHospitality\s*\(\s*\{\s*registerExecutor\s*:\s*\(\s*spec\s*\)\s*=>\s*registry\.registerExecutor\(\s*spec\s*\)\s*\}\s*\)\s*;\s*/g,
  `registry.registerExecutor(hospitalityExecutorSpec);\n`
);

// CIAG
next = next.replace(
  /registerCIAG\s*\(\s*\{\s*registerExecutor\s*:\s*\(\s*spec\s*\)\s*=>\s*registry\.registerExecutor\(\s*spec\s*\)\s*\}\s*\)\s*;\s*/g,
  `registry.registerExecutor(ciagExecutorSpec);\n`
);

// 4) Remove any legacy re-export line that referenced now-nonexistent local identifiers
next = next.replace(/^\s*export\s*\{\s*registerHospitality\s*,\s*registerCIAG\s*\}\s*;\s*$/m, "");

// 5) Write only if changed
if (next !== src) {
  fs.writeFileSync(FILE, next);
  console.log("Patched src/index.ts: mountCHCOpsPlugins now mounts local executor specs (canonical).");
} else {
  console.log("No changes needed (no-op).");
}
