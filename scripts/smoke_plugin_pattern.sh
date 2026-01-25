#!/usr/bin/env bash
set -euo pipefail

node scripts/smoke_plugin_pattern.js
npm run build
