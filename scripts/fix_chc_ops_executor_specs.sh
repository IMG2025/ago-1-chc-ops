#!/usr/bin/env bash
set -euo pipefail

# 1) Create a local executor contract (what registry.registerExecutor expects)
mkdir -p src/contracts

cat > src/contracts/executor.ts <<'TS'
export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;
  supported_task_types: readonly TaskType[];
  required_scopes: Readonly<Record<TaskType, readonly string[]>>;
  domain_action_scopes?: Readonly<Record<string, readonly string[]>>;
  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;
TS

# Ensure contracts index exports it
if [[ -f src/contracts/index.ts ]]; then
  if ! grep -q 'executor.js' src/contracts/index.ts; then
    printf '\nexport * from "./executor.js";\n' >> src/contracts/index.ts
  fi
else
  cat > src/contracts/index.ts <<'TS'
export * from "./plugin.js";
export * from "./executor.js";
TS
fi

# 2) Provide stub CIAG + Hospitality specs matching the contract
cat > src/executors.ts <<'TS'
import type { ExecutorSpec } from "./contracts/executor.js";

export const hospitalityExecutorSpec: ExecutorSpec = {
  domain_id: "hospitality",
  executor_id: "hospitalityExecutor",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["task:execute"],
    ANALYZE: ["task:analyze"],
    ESCALATE: ["task:escalate"],
  },
  domain_action_scopes: {
    RATE_UPDATE: ["hospitality:rates:write"],
    TARIFF_SYNC: ["hospitality:tariffs:sync"],
    VENDOR_INVOICE_CHECK: ["hospitality:invoices:read"],
  },
  validate_inputs: (raw: unknown) => raw,
  execute: (raw: unknown) => ({ status: "STUB_OK", raw }),
};

export const ciagExecutorSpec: ExecutorSpec = {
  domain_id: "ciag",
  executor_id: "ciagExecutor",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["task:execute"],
    ANALYZE: ["task:analyze"],
    ESCALATE: ["task:escalate"],
  },
  validate_inputs: (raw: unknown) => raw,
  execute: (raw: unknown) => ({ status: "STUB_OK", raw }),
};
TS

# 3) Patch src/index.ts to register concrete specs (not unknown)
python - <<'PY'
import pathlib, re

p = pathlib.Path("src/index.ts")
s = p.read_text(encoding="utf-8")

# Ensure it imports specs
if 'from "./executors.js"' not in s:
  # insert after last import
  imports = list(re.finditer(r'^import .*?;\s*$', s, flags=re.M))
  insert_at = imports[-1].end() if imports else 0
  ins = '\nimport { hospitalityExecutorSpec, ciagExecutorSpec } from "./executors.js";\n'
  s = s[:insert_at] + ins + s[insert_at:]

# Remove previous stub marker block if present
s = re.sub(r'/\*\s*PLUGIN_REGISTRATION_STUBS\s*\*/.*?(?=^\s*registerHospitality|\Z)',
           '', s, flags=re.S|re.M)

# Replace registerHospitality/registerCIAG calls to pass real specs
# We assume registry.registerExecutor exists in this file already.
s = re.sub(
  r'registerHospitality\(\{\s*registerExecutor:\s*\(spec:[^)]*\)\s*=>\s*registry\.registerExecutor\(spec\)\s*\}\);\s*',
  'registerHospitality({ registerExecutor: () => registry.registerExecutor(hospitalityExecutorSpec) });\n',
  s
)
s = re.sub(
  r'registerCIAG\(\{\s*registerExecutor:\s*\(spec:[^)]*\)\s*=>\s*registry\.registerExecutor\(spec\)\s*\}\);\s*',
  'registerCIAG({ registerExecutor: () => registry.registerExecutor(ciagExecutorSpec) });\n',
  s
)

p.write_text(s, encoding="utf-8")
PY

# 4) Patch src/plugin.ts to stop referencing a missing name and use spec object
# If plugin.ts exists and is used, make it compile.
python - <<'PY'
import pathlib, re

p = pathlib.Path("src/plugin.ts")
s = p.read_text(encoding="utf-8")

# Ensure it imports the hospitalityExecutorSpec from executors
if 'hospitalityExecutorSpec' in s and 'from "./executors.js"' not in s:
  # drop any bad executor import
  s = re.sub(r'^.*from\s+["\']\.\/executor\.js["\'];\s*\n', '', s, flags=re.M)
  # add correct import
  s = 'import { hospitalityExecutorSpec } from "./executors.js";\n' + s

# Replace HospitalityExecutorSpec type usage if present
s = re.sub(r'PluginRegistrar<\s*HospitalityExecutorSpec\s*>', 'PluginRegistrar<import("./contracts/executor.js").ExecutorSpec>', s)

# Replace any incorrect call using missing symbol
s = s.replace("reg.registerExecutor(hospitalityExecutorSpec);", "reg.registerExecutor(hospitalityExecutorSpec);")

p.write_text(s, encoding="utf-8")
PY

npm run build
