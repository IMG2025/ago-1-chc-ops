#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

npm run build >/dev/null

[[ -x "./scripts/smoke_list_domains.sh" ]] || { echo "FAIL: missing or not executable: ./scripts/smoke_list_domains.sh"; exit 1; }

out="$(./scripts/smoke_list_domains.sh 2>&1 || true)"

# Require the canonical marker line to exist
# Example observed today:
# Mounted domains: [ 'chc', 'ciag', 'hospitality' ]
line="$(printf "%s
" "$out" | grep -F "Mounted domains:" | head -n 1 || true)"
[[ -n "$line" ]] || { echo "FAIL: smoke_list_domains output missing 'Mounted domains:' line"; echo "$out"; exit 1; }

node - <<'NODE' "$line"
const line = process.argv[1];

function fail(msg) { console.error("FAIL:", msg); process.exit(1); }

// Extract bracket payload
const m = line.match(/Mounted domains:s*[(.*)]s*$/);
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
