#!/usr/bin/env bash
set -euo pipefail

# ---------- Ensure local contract types exist ----------
mkdir -p src/contracts

if [[ ! -f src/contracts/plugin.ts ]]; then
  cat > src/contracts/plugin.ts <<'TS'
export interface PluginRegistrar<TSpec> {
  registerExecutor(spec: TSpec): void;
}
TS
fi

if [[ ! -f src/contracts/index.ts ]]; then
  cat > src/contracts/index.ts <<'TS'
export * from "./plugin.js";
TS
fi

# ---------- Ensure executor spec exists with correct exported name ----------
# The error indicates the expected name is HospitalityExecutorSpec (capital H).
if [[ ! -f src/executor.ts ]]; then
  cat > src/executor.ts <<'TS'
export type HospitalityExecutorSpec = Readonly<{
  id: string;
  name: string;
}>;
TS
else
  # If file exists but exports wrong name, normalize it
  if ! grep -q 'export type HospitalityExecutorSpec' src/executor.ts; then
    cat >> src/executor.ts <<'TS'

export type HospitalityExecutorSpec = Readonly<{
  id: string;
  name: string;
}>;
TS
  fi
fi

# ---------- Patch src/plugin.ts ----------
# Goals:
# 1) Import PluginRegistrar from local contracts (not dist)
# 2) Import HospitalityExecutorSpec with correct capitalization
# 3) Provide generic arg PluginRegistrar<HospitalityExecutorSpec>

python - <<'PY'
import pathlib, re

p = pathlib.Path("src/plugin.ts")
s = p.read_text(encoding="utf-8")

# Normalize imports
# Replace any dist-based contract import with local
s = re.sub(r'from\s+["\']ago-1-chc-ops\/dist\/contracts\/plugin\.js["\']',
           'from "./contracts/plugin.js"', s)

# Ensure it imports PluginRegistrar from local contracts
if 'PluginRegistrar' not in s:
  # if no import, add it at top
  s = 'import type { PluginRegistrar } from "./contracts/plugin.js";\n' + s
else:
  s = re.sub(r'import\s+type\s*\{\s*PluginRegistrar\s*\}\s*from\s*["\'][^"\']+["\'];',
             'import type { PluginRegistrar } from "./contracts/plugin.js";', s)

# Fix executor spec import name to HospitalityExecutorSpec
s = re.sub(r'import\s*\{\s*hospitalityExecutorSpec\s*\}\s*from\s*["\']\.\/executor\.js["\'];',
           'import type { HospitalityExecutorSpec } from "./executor.js";', s)

# If it imports HospitalityExecutorSpec already, ensure it's type-only
s = re.sub(r'import\s*\{\s*HospitalityExecutorSpec\s*\}\s*from\s*["\']\.\/executor\.js["\'];',
           'import type { HospitalityExecutorSpec } from "./executor.js";', s)

# Fix function signature: PluginRegistrar requires type arg
# registerHospitality(reg: PluginRegistrar): -> PluginRegistrar<HospitalityExecutorSpec>
s = re.sub(r'(registerHospitality\s*\(\s*reg\s*:\s*)PluginRegistrar(\s*\))',
           r'\1PluginRegistrar<HospitalityExecutorSpec>\2', s)

p.write_text(s, encoding="utf-8")
PY

# ---------- Patch src/index.ts ----------
# Goals:
# 1) Remove imports from "hospitality-ago-1" and "ciag-ago-1"
# 2) Provide local registerHospitality/registerCIAG placeholders
# 3) Type 'spec' to avoid implicit any (use unknown)

python - <<'PY'
import pathlib, re

p = pathlib.Path("src/index.ts")
s = p.read_text(encoding="utf-8")

# Remove direct plugin package imports
s = re.sub(r'^\s*import\s+\{\s*registerHospitality\s*\}\s+from\s+["\']hospitality-ago-1["\'];\s*\n', '', s, flags=re.M)
s = re.sub(r'^\s*import\s+\{\s*registerCIAG\s*\}\s+from\s+["\']ciag-ago-1["\'];\s*\n', '', s, flags=re.M)

marker = "/* PLUGIN_REGISTRATION_STUBS */"
if marker not in s:
  # Insert stubs after last import
  imports = list(re.finditer(r'^import .*?;\s*$', s, flags=re.M))
  insert_at = imports[-1].end() if imports else 0

  stub = f'''
{marker}
type RegisterExecutorFn = (spec: unknown) => void;

function registerHospitality(opts: {{ registerExecutor: RegisterExecutorFn }}): void {{
  opts.registerExecutor({{ id: "hospitalityExecutor", name: "Hospitality Executor" }});
}}

function registerCIAG(opts: {{ registerExecutor: RegisterExecutorFn }}): void {{
  opts.registerExecutor({{ id: "ciagExecutor", name: "CIAG Executor" }});
}}
'''.lstrip("\n")

  s = s[:insert_at] + "\n\n" + stub + "\n" + s[insert_at:]

# Also type any inline (spec) params if they exist in index.ts
s = s.replace("(spec) =>", "(spec: unknown) =>")

p.write_text(s, encoding="utf-8")
PY

npm run build
