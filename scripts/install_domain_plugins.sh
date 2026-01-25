#!/usr/bin/env bash
set -euo pipefail

HOSPITALITY_PATH="$HOME/hospitality-ago-1"
CIAG_PATH="$HOME/work/ciag-ago-1"

for p in "$HOSPITALITY_PATH" "$CIAG_PATH"; do
  if [[ ! -f "$p/package.json" ]]; then
    echo "ERROR: missing package.json at $p"
    exit 1
  fi
done

# Install local domain executors into CHC ops
npm install "$HOSPITALITY_PATH" "$CIAG_PATH"

npm run build
