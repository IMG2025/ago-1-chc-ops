#!/usr/bin/env bash
set -euo pipefail

cat > src/plugin.ts <<'TS'
import type { PluginRegistrar } from "ago-1-chc-ops/dist/contracts/plugin.js";
import { hospitalityExecutorSpec } from "./executor.js";

export function registerHospitality(reg: PluginRegistrar): void {
  reg.registerExecutor(hospitalityExecutorSpec);
}
TS

npm run build
