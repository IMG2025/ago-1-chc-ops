#!/usr/bin/env bash
set -euo pipefail

FILE="src/executors.ts"

# Idempotent patch:
# If hospitality required_scopes already uses hospitality:*, no-op.
# Otherwise replace the hospitality required_scopes block entries for EXECUTE/ANALYZE/ESCALATE.

node - <<'NODE'
import fs from "fs";

const FILE = "src/executors.ts";
const src = fs.readFileSync(FILE, "utf8");

// Quick exit if already canonical
if (
  src.includes('domain_id: "hospitality"') &&
  src.includes('EXECUTE: ["hospitality:execute"]') &&
  src.includes('ANALYZE: ["hospitality:analyze"]') &&
  src.includes('ESCALATE: ["hospitality:escalate"]')
) {
  console.log("Hospitality required_scopes already canonical (no-op).");
  process.exit(0);
}

// Replace only inside hospitalityExecutorSpec required_scopes block
const rx =
  /(export const hospitalityExecutorSpec:\s*ExecutorSpec\s*=\s*\{\s*[\s\S]*?domain_id:\s*"hospitality"[\s\S]*?required_scopes:\s*\{\s*)([\s\S]*?)(\s*\},\s*domain_action_scopes:\s*\{)/m;

const m = src.match(rx);
if (!m) {
  console.error("ERROR: Could not locate hospitalityExecutorSpec required_scopes block.");
  process.exit(1);
}

const before = m[1];
const middle = m[2];
const after = m[3];

// Normalize middle by replacing the three keys (whether task:* or anything else)
let nextMiddle = middle;

// EXECUTE
nextMiddle = nextMiddle.replace(
  /EXECUTE:\s*\[[^\]]*\]\s*,?/m,
  'EXECUTE: ["hospitality:execute"],'
);

// ANALYZE
nextMiddle = nextMiddle.replace(
  /ANALYZE:\s*\[[^\]]*\]\s*,?/m,
  'ANALYZE: ["hospitality:analyze"],'
);

// ESCALATE
nextMiddle = nextMiddle.replace(
  /ESCALATE:\s*\[[^\]]*\]\s*,?/m,
  'ESCALATE: ["hospitality:escalate"],'
);

// If any key was missing, enforce insertion (hardening)
if (!/EXECUTE:\s*\[/.test(nextMiddle)) nextMiddle = 'EXECUTE: ["hospitality:execute"],\n' + nextMiddle;
if (!/ANALYZE:\s*\[/.test(nextMiddle)) nextMiddle = 'ANALYZE: ["hospitality:analyze"],\n' + nextMiddle;
if (!/ESCALATE:\s*\[/.test(nextMiddle)) nextMiddle = 'ESCALATE: ["hospitality:escalate"],\n' + nextMiddle;

const next = src.replace(rx, `${before}${nextMiddle}${after}`);

if (next === src) {
  console.log("No changes applied (unexpected no-op).");
} else {
  fs.writeFileSync(FILE, next);
  console.log("Updated Hospitality required_scopes to canonical hospitality:* scopes.");
}
NODE

npm run build
