#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# 1) Dist entrypoints must be importable (runtime contract)
node - <<'NODE'
async function main() {
  try {
    await import("./dist/index.js");
  } catch (e) {
    console.error("FAIL: dist/index.js import failed");
    console.error(String((e && e.stack) || e));
    process.exit(1);
  }
  try {
    await import("./dist/registry.js");
  } catch (e) {
    console.error("FAIL: dist/registry.js import failed");
    console.error(String((e && e.stack) || e));
    process.exit(1);
  }
  console.log("OK: dist entrypoints importable");
}
main();
NODE

# 2) If package.json defines bin(s), each bin path exists and --help runs (exit 0) and emits non-empty output
bins="$(node - <<'NODE'
import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const bin = pkg.bin;

function emit(name, p) {
  if (typeof p === "string" && p.length) console.log(name + "\t" + p);
}

if (typeof bin === "string") emit(pkg.name || "bin", bin);
else if (bin && typeof bin === "object") {
  for (const [k, v] of Object.entries(bin)) emit(k, v);
}
NODE
)"

if [[ -z "$bins" ]]; then
  echo "OK: no package.json bin defined; CLI contract limited to dist importability"
  exit 0
fi

failed=0
NAMES=""
while IFS=$'\t' read -r name path; do
  [[ -n "$name" ]] || continue
  [[ -n "$path" ]] || continue
  if [[ -z "$NAMES" ]]; then NAMES="$name"; else NAMES="$NAMES,$name"; fi

  if [[ ! -f "$path" ]]; then
    echo "FAIL: bin path missing for $name: $path"
    failed=1
    continue
  fi

  out="$(node "$path" --help 2>&1 || true)"
  if [[ -z "$out" ]]; then
    echo "FAIL: $name --help produced empty output ($path)"
    failed=1
    continue
  fi

  node "$path" --help >/dev/null 2>&1 || { echo "FAIL: $name --help exited non-zero ($path)"; failed=1; }
done <<< "$bins"

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi
echo "OK: CLI bin contract locked for: $NAMES"
