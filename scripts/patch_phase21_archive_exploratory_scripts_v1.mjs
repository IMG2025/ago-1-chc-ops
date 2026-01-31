#!/usr/bin/env node
/**
 * Phase 21 hygiene: archive exploratory scripts that should not stay at scripts/ root.
 * Idempotent. Required gate: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function exists(p) { return fs.existsSync(p); }
function mkdirp(p) { fs.mkdirSync(p, { recursive: true }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
  return prev !== next;
}
function moveIfExists(src, dst) {
  if (!exists(src)) return { moved: false, reason: "missing" };
  if (exists(dst)) return { moved: false, reason: "already archived" };
  mkdirp(path.dirname(dst));
  fs.renameSync(src, dst);
  return { moved: true };
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const ARCH = path.join("scripts", "_archive", "phase21");
mkdirp(ARCH);

const README = path.join(ARCH, "README.md");
const readmeBody =
`# Phase 21 Archive (Exploratory)

This folder contains exploratory scripts created during Phase 21 hardening.
They are retained for auditability, but are **not canonical**.

## Canonical artifacts (kept at scripts/ root)
- scripts/mcp_smoke_phase21.mjs (21A)
- scripts/mcp_smoke_phase21b.mjs (21B)
- scripts/mcp_smoke_phase21c.mjs (21C)
- scripts/patch_phase21c_per_tool_contract_gating_v1.mjs (21C)

## Archived artifacts
Anything moved here was either:
- a superseded patch iteration, or
- a one-off recovery script used during debugging.
`;
writeIfChanged(README, readmeBody);

const candidates = [
  "scripts/patch_phase21_add_capabilities_contract_smoke_v1.mjs",
  "scripts/patch_phase21b_enforce_contract_version_v1.mjs",
  "scripts/patch_phase21b_enforce_contract_version_v2.mjs",
];

// IMPORTANT: We only archive smoke_phase21.mjs if a canonical one already exists and is committed.
// In your case, smoke21 appears untracked; if it’s not canonical, archive it.
// If you want it canonical, we should commit it instead (don’t archive).
const maybeSmoke21 = "scripts/mcp_smoke_phase21.mjs";

let moved = [];
let skipped = [];

for (const src of candidates) {
  const dst = path.join(ARCH, path.basename(src));
  const r = moveIfExists(src, dst);
  if (r.moved) moved.push(src);
  else skipped.push({ src, ...r });
}

// Handle smoke21 carefully: if it is untracked and we already have a canonical smoke21 committed elsewhere,
// archive it. Otherwise leave it in place for an explicit decision.
if (exists(maybeSmoke21)) {
  // If git tracks it, do NOT move it.
  let tracked = false;
  try {
    execSync(`git ls-files --error-unmatch ${maybeSmoke21}`, { stdio: "ignore" });
    tracked = true;
  } catch {}
  if (!tracked) {
    const dst = path.join(ARCH, path.basename(maybeSmoke21));
    const r = moveIfExists(maybeSmoke21, dst);
    if (r.moved) moved.push(maybeSmoke21);
    else skipped.push({ src: maybeSmoke21, ...r });
  } else {
    skipped.push({ src: maybeSmoke21, reason: "tracked-canonical" });
  }
}

console.log(JSON.stringify({ ok: true, moved, skipped }, null, 2));

console.log("== Running build (required gate) ==");
run("npm run build");
