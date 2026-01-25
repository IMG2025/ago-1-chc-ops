#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/executors.ts";
let src = fs.readFileSync(FILE, "utf8");

// Locate hospitalityExecutorSpec block
const rxBlock = /(export const hospitalityExecutorSpec:\s*ExecutorSpec\s*=\s*\{[\s\S]*?\n\};)/m;
const m = src.match(rxBlock);
if (!m) {
  console.error("ERROR: hospitalityExecutorSpec block not found.");
  process.exit(1);
}
const block = m[1];

// Require required_scopes block inside it
const rxReq = /required_scopes:\s*\{\s*([\s\S]*?)\s*\}\s*,/m;
const mr = block.match(rxReq);
if (!mr) {
  console.error("ERROR: required_scopes block not found in hospitalityExecutorSpec.");
  process.exit(1);
}
const reqBody = mr[1];

// Find EXECUTE array
const rxExec = /EXECUTE:\s*\[([\s\S]*?)\]\s*,/m;
const me = reqBody.match(rxExec);
if (!me) {
  console.error("ERROR: required_scopes.EXECUTE array not found for hospitality.");
  process.exit(1);
}

const execInner = me[1];

// Canonical scopes to ensure present
const ensure = [
  "hospitality:execute",
  "hospitality:rates:write",
  "hospitality:tariffs:sync",
  "hospitality:invoices:read",
];

// Parse existing string literals (simple + safe)
const existing = new Set(
  (execInner.match(/["'`][^"'`]+["'`]/g) || []).map(s => s.slice(1, -1))
);

// Build canonical ordered list (preserve any extra existing scopes after ours)
const extras = [...existing].filter(s => !ensure.includes(s)).sort();
const final = [...ensure.filter(s => existing.has(s) || ensure.includes(s)), ...extras];

// Re-render EXECUTE line
const rendered = `EXECUTE: [${final.map(s => `"${s}"`).join(", ")}],`;

// Replace only the EXECUTE entry
const nextReqBody = reqBody.replace(rxExec, rendered + "\n");

// Rebuild block + file
const nextBlock = block.replace(rxReq, `required_scopes: {\n${nextReqBody}\n  },`);
const next = src.replace(block, nextBlock);

if (next === src) {
  console.log("OK: hospitality EXECUTE required_scopes already include action scopes (no-op).");
  process.exit(0);
}

fs.writeFileSync(FILE, next);
console.log("Patched: hospitality EXECUTE required_scopes now include action scopes.");
