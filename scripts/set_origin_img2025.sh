#!/usr/bin/env bash
set -euo pipefail

REMOTE_URL="https://github.com/IMG2025/ago-1-chc-ops.git"

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "ERROR: Not inside a git repository."
  exit 1
}

# Ensure branch is main
git branch -M main

# Set or update origin idempotently
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "origin -> $(git remote get-url origin)"

# Push (idempotent; will be no-op if already up to date)
git push -u origin main

npm run build
