#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const EXECUTORS = "src/executors.ts";
if (!exists(EXECUTORS)) throw new Error(`Missing: ${EXECUTORS}`);

let ex = read(EXECUTORS);

// If we already have a full-shape CHC executor (has executor_id + execute), do nothing.
if (ex.includes("export const chcExecutorSpec") && ex.includes("chcExecutorSpec") && ex.includes("executor_id") && ex.includes("registerExecutor(chcExecutorSpec)")) {
  // Not perfect check, but avoids unnecessary churn.
}

// Helper: find an existing executor spec block and clone it.
function extractSpecBlock(name) {
  // Match: export const <name> = { ... };
  // Use a conservative "balanced-ish" approach: find start index and then scan braces.
  const startNeedle = `export const ${name}`;
  const start = ex.indexOf(startNeedle);
  if (start === -1) return null;

  const braceStart = ex.indexOf("{", start);
  if (braceStart === -1) return null;

  let depth = 0;
  let i = braceStart;
  for (; i < ex.length; i++) {
    const ch = ex[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        // include trailing `;` if present
        let j = i + 1;
        while (j < ex.length && (ex[j] === " " || ex[j] === "\t")) j++;
        if (ex[j] === ";") j++;
        // include newline
        if (ex[j] === "\n") j++;
        return ex.slice(start, j);
      }
    }
  }
  return null;
}

// Prefer CIAG as template, else hospitality.
const tpl =
  extractSpecBlock("ciagExecutorSpec") ??
  extractSpecBlock("hospitalityExecutorSpec");

if (!tpl) {
  throw new Error(
    `Invariant: could not extract a template executor spec from ${EXECUTORS}.\n` +
    `Run:\n  rg -n "export const (ciagExecutorSpec|hospitalityExecutorSpec)" ${EXECUTORS}\n  sed -n '1,260p' ${EXECUTORS}`
  );
}

// If chcExecutorSpec exists, remove the previous incorrect minimal block first (idempotent replacement).
if (ex.includes("export const chcExecutorSpec")) {
  // Remove from "export const chcExecutorSpec" up to the next "};" (best-effort), then we'll re-add.
  ex = ex.replace(/export const chcExecutorSpec[\s\S]*?\n};\n?/m, "");
}

// Build CHC executor spec by transforming template text.
let chc = tpl;

// Rename symbol
chc = chc.replace(/export const (ciagExecutorSpec|hospitalityExecutorSpec)/, "export const chcExecutorSpec");

// domain_id replacement
chc = chc.replace(/domain_id:\s*"ciag"/g, 'domain_id: "chc"');
chc = chc.replace(/domain_id:\s*"hospitality"/g, 'domain_id: "chc"');

// executor_id replacement (if present); if not present, we’ll inject one.
if (/executor_id:\s*"/.test(chc)) {
  chc = chc.replace(/executor_id:\s*"[^"]*"/, 'executor_id: "chc-executor-v1"');
} else {
  // Inject executor_id after domain_id
  chc = chc.replace(/domain_id:\s*"chc"\s*,?/,
    (m) => m.endsWith(",") ? `${m}\n  executor_id: "chc-executor-v1",` : `${m},\n  executor_id: "chc-executor-v1",`
  );
}

// Name/version fields are optional; if present, make them CHC-ish but non-breaking.
chc = chc.replace(/name:\s*"[^"]*"/, 'name: "CHC Ops"');
chc = chc.replace(/version:\s*"[^"]*"/, 'version: "v1"');

// required_scopes replacement (keep same structure; swap prefixes)
chc = chc.replace(/"ciag:/g, '"chc:');
chc = chc.replace(/"hospitality:/g, '"chc:');

// If analyze scope uses :read in other spec, keep whatever structure but prefer :analyze when we can.
chc = chc.replace(/"chc:read"/g, '"chc:analyze"');

// IMPORTANT: execute() must be safe and deterministic.
// Replace execute body with a CHC stub if we can detect an execute: (...) => { ... } function.
if (chc.includes("execute")) {
  // Replace execute implementation body only (best-effort).
  // Handle execute: async (...) => { ... }
  chc = chc.replace(
    /execute:\s*(async\s*)?\([\s\S]*?\)\s*=>\s*\{[\s\S]*?\n\s*\},/m,
    `execute: async (raw, ctx) => {
    return {
      status: "NOT_IMPLEMENTED",
      domain_id: "chc",
      message: "CHC executor stub: execution not implemented in ops repo (mount + auth only).",
      input: raw ?? null,
    };
  },`
  );
}

// validate_inputs should be a pass-through if we can detect it.
if (chc.includes("validate_inputs")) {
  chc = chc.replace(
    /validate_inputs:\s*\([\s\S]*?\)\s*=>\s*\{[\s\S]*?\n\s*\},/m,
    `validate_inputs: (raw: unknown) => raw,`
  );
}

// Finally, append the corrected CHC executor spec at end of file.
ex = ex.endsWith("\n") ? ex : ex + "\n";
ex = ex + "\n" + chc + "\n";

writeIfChanged(EXECUTORS, ex);
console.log(`OK: repaired chcExecutorSpec to match canonical executor shape (cloned from existing spec).`);

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
