#!/usr/bin/env bash
set -euo pipefail

write_if_changed() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"
    echo "UNCHANGED: $path"
    return 0
  fi
  mv "$tmp" "$path"
  echo "WROTE: $path"
}

# -----------------------
# package.json
# -----------------------
write_if_changed package.json <<'JSON'
{
  "name": "ago-1-chc-ops",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ago-1-core": "file:../ago-1-core/ago-1-core-0.1.0.tgz",
    "hospitality-ago-1": "file:../hospitality-ago-1",
    "ciag-ago-1": "file:../ciag-ago-1"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
JSON

# -----------------------
# tsconfig.json
# -----------------------
write_if_changed tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
JSON

# -----------------------
# Minimal in-memory registry + plugin mount
# -----------------------
write_if_changed src/registry.ts <<'TS'
export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;
  supported_task_types: readonly ("EXECUTE" | "ANALYZE" | "ESCALATE")[];
  required_scopes: Readonly<Record<"EXECUTE" | "ANALYZE" | "ESCALATE", readonly string[]>>;
  domain_action_scopes?: Readonly<Record<string, readonly string[]>>;
  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;

export class DomainRegistry {
  private readonly byDomain = new Map<string, ExecutorSpec>();

  registerExecutor(spec: ExecutorSpec): void {
    if (this.byDomain.has(spec.domain_id)) {
      throw new Error(`DUPLICATE_EXECUTOR_FOR_DOMAIN:${spec.domain_id}`);
    }
    this.byDomain.set(spec.domain_id, spec);
  }

  get(domain_id: string): ExecutorSpec | undefined {
    return this.byDomain.get(domain_id);
  }

  listDomains(): readonly string[] {
    return Array.from(this.byDomain.keys()).sort();
  }
}
TS

# -----------------------
# Runtime: mount plugins and execute demo task through core
# -----------------------
write_if_changed src/index.ts <<'TS'
import { DomainRegistry } from "./registry.js";

// core kernel
import { intakeAndDispatch } from "ago-1-core";

// domain plugins
import { registerHospitality } from "hospitality-ago-1";
import { registerCIAG } from "ciag-ago-1";

const registry = new DomainRegistry();

// Mount domain executors (composition layer responsibility)
registerHospitality({ registerExecutor: (spec) => registry.registerExecutor(spec) });
registerCIAG({ registerExecutor: (spec) => registry.registerExecutor(spec) });

console.log("Mounted domains:", registry.listDomains());

// Example: hospitality EXECUTE (will NOOP or STUB depending on hospitality executor mode)
const t = {
  task_id: "chcops-demo-1",
  domain_id: "hospitality",
  task_type: "EXECUTE",
  requested_by: "todd",
  authority_token: "SENTINEL:POLICY-1:abcdefghij",
  sentinel_policy_id: "POLICY-1",
  scope: ["task:execute", "hospitality:execute", "hospitality:rates:write"],
  inputs: {
    action: "RATE_UPDATE",
    property_id: "PROP-001",
    room_type: null,
    date_start: "2026-02-01",
    date_end: "2026-02-07",
    new_rate_cents: 18900,
    currency: "USD"
  },
  created_at: new Date().toISOString()
};

// NOTE: current core’s intakeAndDispatch uses its internal executor mapping.
// Next iteration we will route core dispatch via this registry.
// For now, we demonstrate end-to-end validation + core pipeline execution only.
const r = intakeAndDispatch(t as any);
console.log("RESULT:", r);
TS

# install + build requirement
if [[ ! -d node_modules ]]; then
  npm install
fi

npm run build
