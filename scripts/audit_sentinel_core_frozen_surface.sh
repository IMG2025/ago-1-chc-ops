#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
IDX="$ROOT/packages/sentinel-core/src/index.ts"
PLUGIN="$ROOT/packages/sentinel-core/src/plugin.ts"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$IDX" ] || fail "missing $IDX"
[ -f "$PLUGIN" ] || fail "missing $PLUGIN"

# 1) Ban export-star patterns inside sentinel-core (major source of collisions)
if grep -RIn --include='*.ts' -E '^\s*export\s*\*\s*from\s*' "$ROOT/packages/sentinel-core/src" >/dev/null; then
  echo "---- offending export * lines ----" >&2
  grep -RIn --include='*.ts' -E '^\s*export\s*\*\s*from\s*' "$ROOT/packages/sentinel-core/src" >&2 || true
  fail "sentinel-core must not use 'export * from ...'"
fi

# 2) Ensure index.ts contains the canonical exports we depend on (v7 surface)
grep -qE 'export\s+type\s+\{\s*ExecutorSpec,\s*ExecutorRegistry\s*\}\s+from\s+"\./registry\.js";' "$IDX" \
  || fail "index.ts must export types ExecutorSpec, ExecutorRegistry from ./registry.js"

grep -qE 'export\s+\{\s*DomainRegistry,\s*createRegistry\s*\}\s+from\s+"\./registry\.js";' "$IDX" \
  || fail "index.ts must export DomainRegistry, createRegistry from ./registry.js"

grep -qE 'export\s+\{\s*registerExecutor,\s*mountCHCOpsPlugins\s*\}\s+from\s+"\./plugin\.js";' "$IDX" \
  || fail "index.ts must export registerExecutor, mountCHCOpsPlugins from ./plugin.js"

grep -qE 'export\s+type\s+\{\s*RegisterExecutorFn\s*\}\s+from\s+"\./plugin\.js";' "$IDX" \
  || fail "index.ts must export type RegisterExecutorFn from ./plugin.js"

grep -qE 'export\s+type\s+TaskType\s*=' "$IDX" \
  || fail "index.ts must export TaskType type alias"

# 3) Ensure plugin contract is the canonical 1-arg registrar callback
grep -qE 'export\s+type\s+RegisterExecutorFn\s*=\s*\(\s*spec:\s*ExecutorSpec\s*\)\s*=>\s*void\s*;' "$PLUGIN" \
  || fail "plugin.ts must define RegisterExecutorFn = (spec: ExecutorSpec) => void"

# 4) Ensure mountCHCOpsPlugins exists (compat + diagnostics)
grep -qE 'export\s+function\s+mountCHCOpsPlugins\s*\(' "$PLUGIN" \
  || fail "plugin.ts must export mountCHCOpsPlugins"

echo "OK: sentinel-core frozen surface audit passed."
npm run build
./scripts/audit_sentinel_policy_binding_frozen_surface.sh
./scripts/audit_sentinel_policy_binding_termux_bridge_v1.sh
