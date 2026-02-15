#!/usr/bin/env node
/**
 * AGO Repo Audit v1
 * - Idempotent: produces/overwrites a deterministic report file.
 * - Computes a "spec match %" from objective checks.
 * - Ends with: npm run build
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8", ...opts }).trim();
}
function runInherit(cmd) {
  execSync(cmd, { stdio: "inherit" });
}
function exists(p) {
  return fs.existsSync(p);
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

const ROOT = safe(() => run("git rev-parse --show-toplevel"), process.cwd());
process.chdir(ROOT);

const pkgPath = path.join(ROOT, "package.json");
if (!exists(pkgPath)) {
  throw new Error(`Missing package.json at repo root: ${ROOT}`);
}

const pkg = readJson(pkgPath);
const scripts = pkg.scripts || {};

const checks = [];
function check(id, desc, pass, weight = 1, evidence = "") {
  checks.push({ id, desc, pass: !!pass, weight, evidence });
}

const nodeV = safe(() => run("node -v"), "unknown");
const npmV = safe(() => run("npm -v"), "unknown");
const isTermux = !!process.env.PREFIX && String(process.env.PREFIX).includes("com.termux");
const gitStatus = safe(() => run("git status --porcelain"), "");
const cleanTree = gitStatus.length === 0;

check("env.termux", "Running inside Termux (PREFIX contains com.termux)", isTermux, 1, `PREFIX=${process.env.PREFIX || ""}`);
check("env.node", "Node available", nodeV !== "unknown", 2, `node=${nodeV}`);
check("env.npm", "npm available", npmV !== "unknown", 2, `npm=${npmV}`);

check("repo.git", "Git repo present", safe(() => run("git rev-parse --is-inside-work-tree") === "true", false), 1, "");
check("repo.cleanTree", "Working tree clean (no uncommitted changes)", cleanTree, 2, cleanTree ? "clean" : gitStatus);

check("pkg.build", "package.json has scripts.build", typeof scripts.build === "string" && scripts.build.length > 0, 3, scripts.build || "");
check("pkg.typecheck", "package.json has scripts.typecheck or scripts.check", !!scripts.typecheck || !!scripts.check, 1, scripts.typecheck || scripts.check || "");

const tsconfigExists = exists(path.join(ROOT, "tsconfig.json")) || exists(path.join(ROOT, "tsconfig.base.json"));
check("ts.tsconfig", "tsconfig present", tsconfigExists, 2, tsconfigExists ? "found" : "missing");

const scriptsDir = path.join(ROOT, "scripts");
check("fs.scriptsDir", "scripts/ directory present", exists(scriptsDir), 1, exists(scriptsDir) ? "found" : "missing");

const hasMjsScripts = safe(() => {
  if (!exists(scriptsDir)) return false;
  const files = fs.readdirSync(scriptsDir);
  return files.some(f => f.endsWith(".mjs"));
}, false);
check("fs.mjsScripts", "scripts/ contains .mjs automation scripts", hasMjsScripts, 2, hasMjsScripts ? "present" : "absent");

const docsDir = path.join(ROOT, "docs");
check("fs.docsDir", "docs/ directory present (runbooks/specs live here)", exists(docsDir), 1, exists(docsDir) ? "found" : "missing");

const hasRunbook = safe(() => {
  if (!exists(docsDir)) return false;
  const files = fs.readdirSync(docsDir);
  return files.some(f => /runbook/i.test(f));
}, false);
check("docs.runbook", "Runbook present in docs/ (name contains 'runbook')", hasRunbook, 2, hasRunbook ? "present" : "absent");

const hasTests = exists(path.join(ROOT, "test")) || exists(path.join(ROOT, "tests")) || exists(path.join(ROOT, "__tests__"));
check("qa.testsDir", "Tests directory present", hasTests, 2, hasTests ? "present" : "absent");

const hasGolden = safe(() => {
  const s = Object.keys(scripts).join(" ");
  return /golden/i.test(s);
}, false);
check("qa.golden", "Golden path script present (scripts contains 'golden')", hasGolden, 1, hasGolden ? "present" : "absent");

const totalWeight = checks.reduce((a, c) => a + c.weight, 0);
const passWeight = checks.filter(c => c.pass).reduce((a, c) => a + c.weight, 0);
const percent = totalWeight === 0 ? 0 : Math.round((passWeight / totalWeight) * 100);

const report = {
  repoRoot: ROOT,
  timestamp: new Date().toISOString(),
  environment: {
    platform: os.platform(),
    arch: os.arch(),
    termux: isTermux,
    node: nodeV,
    npm: npmV
  },
  git: {
    cleanTree,
    statusPorcelain: gitStatus
  },
  specMatch: {
    percent,
    totalWeight,
    passWeight
  },
  checks
};

const outPath = path.join(ROOT, "artifacts", "ago_repo_audit_v1.json");
writeJson(outPath, report);

console.log(`\nAGO repo audit written: ${outPath}`);
console.log(`Spec match (objective): ${percent}% (${passWeight}/${totalWeight} weighted)\n`);

// Required final gate (per operating rule)
runInherit("npm run build");
