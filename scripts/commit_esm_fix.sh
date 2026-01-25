#!/usr/bin/env bash
set -euo pipefail

git add src/contracts/index.ts
git commit -m "fix(chc-ops): explicit .js extensions for ESM contract exports"
git push
npm run build
