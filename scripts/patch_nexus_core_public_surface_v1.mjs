#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

function mustExist(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing: ${rel}`);
  return p;
}

function writeIfChanged(filePath, next) {
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (prev !== next) fs.writeFileSync(filePath, next);
}

function ensureExecutable(filePath) {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // noop (Termux FS quirks / permissions)
  }
}

// ---- Targets ----
const NEXUS_ORCH = mustExist("packages/nexus-core/src/orchestrator.ts");
const NEXUS_INDEX = mustExist("packages/nexus-core/src/index.ts");
mustExist("packages/nexus-core/package.json");
const ROOT_PKG = mustExist("package.json");

// =======================================================
// A) Canonicalize nexus-core orchestrator contract (v1)
// =======================================================
const orchestratorOut = `/**
 * Nexus Core — Orchestration Contract (Public Surface v1)
 *
 * Guardrail: this file defines the ONLY stable orchestration seam.
 * - No deep-import consumers should rely on internals outside index.ts.
 * - Keep types minimal and forward-compatible.
 */

export type TaskId = string;
export type DomainId = string;
export type TaskType = string;

/**
 * Minimal envelope that Nexus can route and orchestrate.
 * We keep payload unknown to avoid coupling to domain internals.
 */
export interface TaskEnvelope {
  task_id: TaskId;
  domain_id: DomainId;
  task_type: TaskType;
  payload: unknown;
  /**
   * Optional scope/context for governance layers (Sentinel).
   * Nexus itself should not authorize; it should consume an already-authorized call path.
   */
  scopes?: readonly string[];
  meta?: Readonly<Record<string, unknown>>;
}

/**
 * Minimal orchestration result. Payload remains unknown to avoid coupling.
 */
export interface OrchestrationResult {
  task_id: TaskId;
  status: "OK" | "ERROR";
  output?: unknown;
  error?: {
    code: string;
    message: string;
    meta?: Readonly<Record<string, unknown>>;
  };
}

/**
 * Orchestrator interface — the stable behavioral surface.
 */
export interface Orchestrator {
  orchestrate(task: TaskEnvelope): Promise<OrchestrationResult> | OrchestrationResult;
}

/**
 * Minimal default orchestrator (placeholder).
 * This ensures the package compiles and provides a usable object for smoke tests,
 * without asserting runtime behavior beyond contract shape.
 */
export const defaultOrchestrator: Orchestrator = {
  orchestrate(task: TaskEnvelope): OrchestrationResult {
    return { task_id: task.task_id, status: "ERROR", error: { code: "NOT_IMPLEMENTED", message: "Nexus orchestrator not implemented." } };
  },
};
`;

writeIfChanged(NEXUS_ORCH, orchestratorOut + "\n");

// =======================================================
// B) Canonicalize nexus-core index.ts (public surface only)
// =======================================================
const indexOut = `// Nexus Core — Canonical Public Surface (v1)
// Guardrail: do not use 'export * from ...' (prevents drift + collisions).

export type {
  TaskId,
  DomainId,
  TaskType,
  TaskEnvelope,
  OrchestrationResult,
  Orchestrator,
} from "./orchestrator.js";

export { defaultOrchestrator } from "./orchestrator.js";
`;

writeIfChanged(NEXUS_INDEX, indexOut + "\n");

// =======================================================
// C) Add frozen-surface audits for Nexus (mirrors sentinel discipline)
// =======================================================
const AUDIT_NO_STAR = path.join(ROOT, "scripts/audit_nexus_core_frozen_surface.sh");
const auditNoStarOut = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PKG="$ROOT/packages/nexus-core"

# 1) No star exports anywhere in nexus-core/src
if grep -R --line-number -E '^\\s*export\\s+\\*\\s+from\\s+' "$PKG/src" >/tmp/nexus_star_exports.txt 2>/dev/null; then
  echo "---- offending export * lines ----"
  cat /tmp/nexus_star_exports.txt
  echo "FAIL: nexus-core must not use 'export * from ...'"
  exit 1
fi

# 2) index.ts must be canonical (only allowed exports)
IDX="$PKG/src/index.ts"
if [[ ! -f "$IDX" ]]; then
  echo "FAIL: missing $IDX"
  exit 1
fi

# quick sanity checks — keep strict to prevent drift
if ! grep -q 'Canonical Public Surface (v1)' "$IDX"; then
  echo "FAIL: nexus-core index.ts missing canonical header"
  exit 1
fi

echo "OK: nexus-core frozen surface audit passed."
`;
writeIfChanged(AUDIT_NO_STAR, auditNoStarOut + "\n");
ensureExecutable(AUDIT_NO_STAR);

// Optional deep-import audit: only checks repo consumers for @chc/nexus-core/* patterns
const AUDIT_NO_DEEP = path.join(ROOT, "scripts/audit_no_deep_imports_nexus_core.sh");
const auditNoDeepOut = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"

# Guardrail: no deep imports like @chc/nexus-core/src/... or @chc/nexus-core/dist/...
# We allow "@chc/nexus-core" only.

if grep -R --line-number -E '@chc/nexus-core/' "$ROOT/src" "$ROOT/packages" 2>/tmp/nexus_deep_imports.txt; then
  echo "---- offending deep import lines ----"
  cat /tmp/nexus_deep_imports.txt
  echo "FAIL: nexus-core deep imports detected. Use '@chc/nexus-core' only."
  exit 1
fi

echo "OK: no nexus-core deep imports detected."
`;
writeIfChanged(AUDIT_NO_DEEP, auditNoDeepOut + "\n");
ensureExecutable(AUDIT_NO_DEEP);

// =======================================================
// D) Wire audits into root npm test (idempotent insertion)
// =======================================================
let rootPkg = fs.readFileSync(ROOT_PKG, "utf8");
let pkgJson;
try {
  pkgJson = JSON.parse(rootPkg);
} catch (e) {
  throw new Error("Root package.json is not valid JSON");
}

pkgJson.scripts = pkgJson.scripts || {};
const testCmd = String(pkgJson.scripts.test || "");

const mustHave = [
  "./scripts/audit_no_deep_imports_nexus_core.sh",
  "./scripts/audit_nexus_core_frozen_surface.sh",
];

function ensureInChain(cmd, insert) {
  if (cmd.includes(insert)) return cmd;
  // Insert right after sentinel audits if present; otherwise prepend.
  const sentinelAnchor = "./scripts/audit_sentinel_core_frozen_surface.sh";
  if (cmd.includes(sentinelAnchor)) {
    return cmd.replace(sentinelAnchor, `${sentinelAnchor} && ${insert}`);
  }
  // fallback: prepend
  return `${insert} && ${cmd}`.trim();
}

let nextTest = testCmd;
for (const ins of mustHave) nextTest = ensureInChain(nextTest, ins);

if (nextTest !== testCmd) {
  pkgJson.scripts.test = nextTest;
  writeIfChanged(ROOT_PKG, JSON.stringify(pkgJson, null, 2) + "\n");
}

console.log("OK: nexus-core public surface v1 locked + audits wired into npm test.");

// =======================================================
// E) Gates (must end green)
// =======================================================
run("npm test");
run("npm run build");
