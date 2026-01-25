#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
node scripts/patch_step_8_enforce_canonical_surface_v1.mjs
