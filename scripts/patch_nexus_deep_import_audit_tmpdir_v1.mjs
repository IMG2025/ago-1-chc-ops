#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const AUDIT = "scripts/audit_no_deep_imports_nexus_core.sh";
if (!fs.existsSync(AUDIT)) throw new Error(`Missing: ${AUDIT}`);

let s = read(AUDIT);

// 1) Replace any /tmp/<file> usages with repo-local .tmp/<file> (Termux-safe)
s = s.replace(/\/tmp\/([A-Za-z0-9._-]+)/g, ".tmp/$1");

// 2) Ensure .tmp exists during audit
const mk = 'mkdir -p ".tmp"';
if (!s.includes(mk)) {
  if (s.startsWith("#!")) {
    const lines = s.split("\n");
    lines.splice(1, 0, mk);
    s = lines.join("\n");
  } else {
    s = mk + "\n" + s;
  }
}

writeIfChanged(AUDIT, s.trimEnd() + "\n");
fs.mkdirSync(".tmp", { recursive: true });

console.log("OK: nexus deep-import audit tmpdir hardened (.tmp, no /tmp).");

// Gates
run("npm test");
run("npm run build");
