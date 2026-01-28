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

const AUDIT = "scripts/audit_smoke_list_domains_contract_v1.sh";
if (!exists(AUDIT)) throw new Error(`Missing: ${AUDIT}`);

// Replace the broken node invocation + argv indexing safely by rewriting the audit file fully (canonical).
const auditSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

[[ -x "./scripts/smoke_list_domains.sh" ]] || { echo "FAIL: missing or not executable: ./scripts/smoke_list_domains.sh"; exit 1; }

out="$(./scripts/smoke_list_domains.sh 2>&1 || true)"

# Require the canonical marker line to exist
line="$(printf "%s\\n" "$out" | grep -F "Mounted domains:" | head -n 1 || true)"
[[ -n "$line" ]] || { echo "FAIL: smoke_list_domains output missing 'Mounted domains:' line"; echo "$out"; exit 1; }

# IMPORTANT: pass line as argv[2] by using: node - "$line" <<'NODE'
node - "$line" <<'NODE'
const line = process.argv[2] ?? process.argv[1];

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

if (typeof line !== "string" || !line.length) fail("Mounted domains line missing argv: " + JSON.stringify(process.argv));

const m = line.match(/Mounted domains:\\s*\\[(.*)\\]\\s*$/);
if (!m) fail("Mounted domains line format drift: " + line);

const inside = m[1].trim();
if (!inside.length) fail("Mounted domains list empty: " + line);

// Parse domains from the bracket list (single-quoted)
const domains = [];
for (const part of inside.split(",")) {
  const s = part.trim();
  const mm = s.match(/^'([^']+)'$/);
  if (!mm) fail("Mounted domains entry format drift: " + s + " in line: " + line);
  domains.push(mm[1]);
}

const EXPECTED = ["chc","ciag","hospitality"].slice().sort();
const got = domains.slice().sort();

if (JSON.stringify(got) !== JSON.stringify(EXPECTED)) {
  fail("Mounted domains drift. expected=" + JSON.stringify(EXPECTED) + " got=" + JSON.stringify(got));
}

console.log("OK: smoke_list_domains contract locked:", domains);
NODE

echo "OK: smoke_list_domains contract audit passed"
`;

writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log("OK: repaired " + AUDIT);

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
