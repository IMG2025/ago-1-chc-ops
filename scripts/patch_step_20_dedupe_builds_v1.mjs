#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const PKG = "package.json";
if (!exists(PKG)) throw new Error("Missing: package.json");

// ------------------------------------------------------------
// 1) Remove internal npm run build calls from audits (they run under npm test already)
// ------------------------------------------------------------
const AUDITS = [
  "scripts/audit_authorization_contract_v1.sh",
  "scripts/audit_registry_contract_v1.sh",
  "scripts/audit_smoke_list_domains_contract_v1.sh",
  "scripts/audit_cli_contract_v1.sh",
];

for (const p of AUDITS) {
  if (!exists(p)) continue;
  const prev = read(p);
  let next = prev;

  // Remove lines that run build silently
  next = next.replace(/\n\s*npm run build\s*>\/dev\/null\s*\n/g, "\n\n");
  next = next.replace(/\n\s*npm run build\s*>\/dev\/null\s*$/g, "\n");
  next = next.replace(/^\s*npm run build\s*>\/dev\/null\s*\n/mg, "");

  // Normalize excessive blank lines (keep readable but not noisy)
  next = next.replace(/\n{4,}/g, "\n\n\n");

  if (next !== prev) {
    writeIfChanged(p, next);
    chmod755(p);
    console.log("OK: removed internal build from " + p);
  } else {
    console.log("OK: no internal build to remove in " + p);
  }
}

// ------------------------------------------------------------
// 2) Dedupe npm run build occurrences in package.json scripts.test
//    Keep exactly one build, placed immediately after audit_no_deep_imports_* (early), if present,
//    otherwise at the beginning.
// ------------------------------------------------------------
const pkg = JSON.parse(read(PKG));
const t0 = pkg.scripts?.test;
if (typeof t0 !== "string") throw new Error("Invariant: scripts.test missing or not a string.");

let t = t0;

// Split by && while preserving ordering
const parts = t.split("&&").map(s => s.trim()).filter(Boolean);

// Remove all explicit "npm run build" tokens
const filtered = [];
for (const part of parts) {
  if (part === "npm run build") continue;
  filtered.push(part);
}

// Decide insertion point: after the last "audit_no_deep_imports" script if present, else at start
let insertAt = 0;
for (let i = 0; i < filtered.length; i++) {
  if (filtered[i].includes("audit_no_deep_imports")) insertAt = i + 1;
}

filtered.splice(insertAt, 0, "npm run build");

// Reconstruct
t = filtered.join(" && ");

if (t !== t0) {
  pkg.scripts.test = t;
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: deduped npm run build in scripts.test (kept exactly one)");
} else {
  console.log("OK: scripts.test already deduped");
}

// ------------------------------------------------------------
// 3) Gates (must end with npm run build)
// ------------------------------------------------------------
run("npm test");
run("npm run build");
