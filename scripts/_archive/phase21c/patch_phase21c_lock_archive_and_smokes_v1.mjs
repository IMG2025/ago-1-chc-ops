#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }
function exists(p) { return fs.existsSync(p); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }
function mvIfExists(from, toDir) {
  if (!exists(from)) return false;
  mkdirp(toDir);
  const base = path.basename(from);
  const to = path.join(toDir, base);
  if (exists(to)) {
    // If already archived, remove source to keep idempotency clean
    fs.rmSync(from);
    return true;
  }
  fs.renameSync(from, to);
  return true;
}

const ROOT = sh("git rev-parse --show-toplevel");
process.chdir(ROOT);

const ARCH = path.join("scripts", "_archive", "phase21c");
mkdirp(ARCH);

const CANONICAL_KEEP = new Set([
  "patch_phase21c_per_tool_contract_gating_v1.mjs",
  "mcp_smoke_phase21c.mjs",
  "mcp_smoke_phase21b.mjs",
  "mcp_smoke_phase20.mjs",
]);

// --------- Archive Phase 21C exploratory scripts ----------
const scriptsDir = "scripts";
const entries = fs.readdirSync(scriptsDir, { withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => d.name);

const toArchive = [];
for (const name of entries) {
  if (name === "mcp_smoke_phase21.mjs") {
    toArchive.push(path.join(scriptsDir, name));
    continue;
  }
  // Archive any phase21c one-off patch scripts except the canonical per-tool gate script
  if (name.startsWith("patch_phase21c_") && !CANONICAL_KEEP.has(name)) {
    toArchive.push(path.join(scriptsDir, name));
  }
}

let archivedCount = 0;
for (const f of toArchive) {
  if (mvIfExists(f, ARCH)) archivedCount++;
}

// --------- Write archive README ----------
const readmePath = path.join(ARCH, "README.md");
const archivedNames = fs.readdirSync(ARCH, { withFileTypes: true })
  .filter(d => d.isFile())
  .map(d => d.name)
  .sort();

const readme = `# Phase 21C Archive (Exploratory / One-offs)

Purpose: preserve exploratory Phase 21C patch scripts without polluting the canonical script surface.

## Canonical (remain in /scripts root)
- patch_phase21c_per_tool_contract_gating_v1.mjs
- mcp_smoke_phase20.mjs
- mcp_smoke_phase21b.mjs
- mcp_smoke_phase21c.mjs

## Archived here
${archivedNames.filter(n => n !== "README.md").map(n => `- ${n}`).join("\n") || "- (none)"}

Notes:
- This archive is managed by: scripts/patch_phase21c_lock_archive_and_smokes_v1.mjs
`;
writeIfChanged(readmePath, readme);

// --------- Ensure smoke20 includes contractVersion (required after 21A enforcement) ----------
const SMOKE20 = path.join("scripts", "mcp_smoke_phase20.mjs");
if (!exists(SMOKE20)) throw new Error("Missing canonical smoke20: " + SMOKE20);

let s20 = read(SMOKE20);

// If ctx has no contractVersion, inject contractVersion: "21A.1.0" after traceId
if (!s20.includes("contractVersion")) {
  // Look for the ctx block containing traceId
  const re = /(ctx:\s*\{\s*[\s\S]*?traceId:\s*[^,\n}]+)([\s\S]*?\})/m;
  if (!re.test(s20)) {
    throw new Error("Unsafe: could not locate ctx.traceId anchor in mcp_smoke_phase20.mjs");
  }
  s20 = s20.replace(re, (_m, p1, p2) => `${p1},\n        contractVersion: "21A.1.0"${p2}`);
  writeIfChanged(SMOKE20, s20);
}

// Tighten formatting if earlier patch introduced odd spacing
s20 = read(SMOKE20).replace(/ctx:\s*\{\s*tenant,\s*/g, "ctx: {\n        tenant,\n        ");
writeIfChanged(SMOKE20, s20);

// Ensure executable bit where needed
chmod755(SMOKE20);
chmod755(path.join("scripts","mcp_smoke_phase21b.mjs"));
chmod755(path.join("scripts","mcp_smoke_phase21c.mjs"));
chmod755(readmePath);

console.log(`Archived Phase21C one-offs: ${archivedCount}`);
console.log("Patched (if needed): scripts/mcp_smoke_phase20.mjs (contractVersion injection)");
console.log("== Syntax check (required gate) ==");
run("node --check " + SMOKE20);
console.log("== Running build (required gate) ==");
run("npm run build");
