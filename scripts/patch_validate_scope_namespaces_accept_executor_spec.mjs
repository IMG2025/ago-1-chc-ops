#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";

if (!fs.existsSync(FILE)) {
  console.error("ERROR: src/registry.ts not found");
  process.exit(1);
}

let src = fs.readFileSync(FILE, "utf8");

// If already fixed, no-op
if (src.includes("validateScopeNamespaces(spec: ExecutorSpec)")) {
  console.log("OK: validateScopeNamespaces already accepts ExecutorSpec (no-op)");
  process.exit(0);
}

const rx =
/function validateScopeNamespaces\s*\(\s*spec\s*:\s*[\s\S]*?\)\s*\{/m;

if (!rx.test(src)) {
  console.error("ERROR: validateScopeNamespaces function not found");
  process.exit(1);
}

const replacement =
`function validateScopeNamespaces(spec: ExecutorSpec) {`;

src = src.replace(rx, replacement);

fs.writeFileSync(FILE, src);
console.log("Patched: validateScopeNamespaces now accepts ExecutorSpec");
