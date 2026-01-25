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

const AUDIT = "scripts/audit_sentinel_nexus_handshake_frozen_surface.sh";
if (!fs.existsSync(AUDIT)) throw new Error(`Missing: ${AUDIT}`);

let s = read(AUDIT);

// Replace any /tmp/<file> usage with repo-local .tmp/<file>
s = s.replace(/\/tmp\/([A-Za-z0-9._-]+)/g, ".tmp/$1");

// Ensure .tmp exists during audit
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

// Create the dir now as well
fs.mkdirSync(".tmp", { recursive: true });

console.log("OK: handshake audit tmpdir hardened (.tmp, no /tmp).");

// Gates (end with npm run build)
run("npm test");
run("npm run build");
