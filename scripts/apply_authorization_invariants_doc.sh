#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

node scripts/create_authorization_invariants_doc.mjs

# required final gate
npm run build
