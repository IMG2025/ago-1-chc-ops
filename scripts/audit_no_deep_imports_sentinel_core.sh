#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

fail() { echo "FAIL: $1" >&2; exit 1; }

# Search only our TS sources (exclude dist, node_modules, packages/sentinel-core itself)
HITS="$(
  grep -RIn --include='*.ts' \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=packages/sentinel-core \
    -E '(@chc/sentinel-core/(src|dist)|packages/sentinel-core/)' \
    "$ROOT" || true
)"

if [ -n "$HITS" ]; then
  echo "---- forbidden sentinel-core deep import hits ----" >&2
  echo "$HITS" >&2
  fail "deep imports into sentinel-core are forbidden. Use only: import ... from \"@chc/sentinel-core\""
fi

echo "OK: no sentinel-core deep imports detected."
npm run build
