#!/usr/bin/env bash
set -euo pipefail

# Guard: must be in repo root
git rev-parse --show-toplevel >/dev/null 2>&1 || { echo "ERROR: not in a git repo"; exit 1; }

mkdir -p src/contracts

# 1) Create canonical contracts (overwrite is intentional + deterministic)
cat > src/contracts/executor.ts <<'TS'
export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

/**
 * Map from task type -> required scopes.
 * Partial: a domain may omit keys it does not support.
 * Readonly: contract is immutable once registered.
 */
export type RequiredScopes = Readonly<Partial<Record<TaskType, readonly string[]>>>;

export type ExecutorSpec = Readonly<{
  domain_id: string;
  executor_id: string;

  /** Which tasks this executor supports */
  supported_task_types: readonly TaskType[];

  /**
   * Scopes required to perform tasks (by type).
   * Partial is allowed to avoid forcing ESCALATE/ANALYZE for domains that don't implement them.
   */
  required_scopes: RequiredScopes;

  /**
   * Optional finer-grained scopes per action inside the domain.
   * Example: { "tariff:classify": ["scope:a", "scope:b"] }
   */
  domain_action_scopes?: Readonly<Record<string, readonly string[]>>;

  validate_inputs: (raw: unknown) => unknown;
  execute: (raw: unknown) => unknown;
}>;
TS

cat > src/contracts/registry.ts <<'TS'
import type { ExecutorSpec } from "./executor";

/**
 * Minimal registry contract CHC Ops depends on.
 * Domain registries may implement additional methods, but must satisfy this.
 */
export type ExecutorRegistryLike = {
  registerExecutor: (spec: ExecutorSpec) => void;
};
TS

cat > src/contracts/plugin.ts <<'TS'
import type { ExecutorRegistryLike } from "./registry";

/**
 * Single, canonical plugin registration contract.
 * Every domain plugin must expose a register function that conforms to this shape.
 */
export type RegisterPluginFn = (reg: ExecutorRegistryLike) => void;
TS

cat > src/contracts/index.ts <<'TS'
export * from "./executor";
export * from "./registry";
export * from "./plugin";
TS

# 2) Ensure top-level barrel exports contracts (idempotent)
if [ -f src/index.ts ]; then
  node - <<'NODE'
import fs from "fs";

const file = "src/index.ts";
let s = fs.readFileSync(file, "utf8");

const exportLine = `export * from "./contracts/index.js";`;
if (!s.includes(exportLine)) {
  // Append at end, preserving existing content
  if (!s.endsWith("\n")) s += "\n";
  s += "\n" + exportLine + "\n";
  fs.writeFileSync(file, s);
  console.log("Added contracts export to src/index.ts");
} else {
  console.log("Contracts export already present in src/index.ts");
}
NODE
fi

# 3) Ensure package.json exports ./contracts for consumers (idempotent)
node - <<'NODE'
import fs from "fs";

const file = "package.json";
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));

pkg.exports ||= {};
// Preserve existing exports; only add contracts if missing.
pkg.exports["./contracts"] ||= {
  types: "./dist/contracts/index.d.ts",
  default: "./dist/contracts/index.js"
};

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log("Ensured package.json exports ./contracts");
NODE

# 4) Ensure tsconfig includes src (normally already; keep safe + idempotent)
if [ -f tsconfig.json ]; then
  node - <<'NODE'
import fs from "fs";

const file = "tsconfig.json";
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));

cfg.include ||= ["src"];
if (!cfg.include.includes("src")) cfg.include.push("src");

fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
console.log("Ensured tsconfig.json includes src");
NODE
fi

# Guardrail
npm run build
