#!/usr/bin/env bash
set -euo pipefail

TAG="v0.1.0-contract-surface-locked"
MSG="Lock CHC Ops contract surface (registry/executor/plugin contracts)."

# Ensure we are in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "ERROR: Not inside a git repository."; exit 1; }

# Ensure branch is main (no-op if already)
git branch -M main

# Ensure we have an origin (no-op if already)
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "ERROR: origin remote not set. Set it first, then re-run."
  exit 1
fi

# Create tag if missing (idempotent)
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag already exists: $TAG"
else
  git tag -a "$TAG" -m "$MSG"
  echo "Created tag: $TAG"
fi

# Push tag (idempotent)
git push origin "$TAG" || true

# Guardrail
npm run build
