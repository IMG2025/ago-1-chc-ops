#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function ensureFile(p, content) {
  ensureDir(path.dirname(p));
  writeIfChanged(p, content);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SENTINEL_PKG = "packages/sentinel-core";
const SENTINEL_SRC = path.join(SENTINEL_PKG, "src");
const SENTINEL_INDEX = path.join(SENTINEL_SRC, "index.ts");
const BINDING = path.join(SENTINEL_SRC, "policy_binding_v1.ts");
const AUDIT = "scripts/audit_sentinel_policy_binding_frozen_surface.sh";

if (!fs.existsSync(SENTINEL_PKG)) {
  throw new Error(`Invariant: missing ${SENTINEL_PKG}.`);
}
if (!fs.existsSync(SENTINEL_INDEX)) {
  throw new Error(`Invariant: missing ${SENTINEL_INDEX}.`);
}

// ------------------------------
// Step 8: Policy Execution Binding v1
// ------------------------------
// Goal: Sentinel owns policy evaluation semantics.
// Nexus consumes ONLY the handshake decision/result via the handshake contract.
// Binding is intentionally minimal & stable (v1), and can wrap existing internal policy engines.
const bindingTs = `/**
 * Sentinel Policy Execution Binding (v1)
 *
 * First-principles guardrails:
 * - Nexus must NOT own authorization semantics.
 * - Sentinel evaluates policy and emits a handshake-level decision.
 * - This binding provides a stable adapter surface for policy engines to plug into.
 * - Keep this surface minimal and audit-gated.
 */

import type { GovernanceGateway, HandshakeDecision, HandshakeRequest } from "@chc/nexus-core";

/** Minimal policy rule interface for v1. */
export type PolicyRule = Readonly<{
  id: string;
  name: string;
  /** Return true if this rule applies to the request. */
  applies: (req: HandshakeRequest) => boolean;
  /** Return the handshake decision (ALLOW/DENY/etc) using the canonical handshake contract. */
  decide: (req: HandshakeRequest) => HandshakeDecision;
}>;

export type PolicyEngine = Readonly<{
  /** Rules are evaluated in order; first match wins (v1). */
  rules: readonly PolicyRule[];
}>;

/**
 * Create a GovernanceGateway from a policy engine.
 * - v1 semantics: first matching rule decides; if none match, engine must provide a default rule.
 * - We intentionally do NOT inspect request shape here; rules do that.
 */
export function createGovernanceGatewayV1(engine: PolicyEngine): GovernanceGateway {
  if (!engine?.rules?.length) {
    const err = new Error("POLICY_ENGINE_EMPTY");
    // @ts-expect-error attach metadata
    err.code = "POLICY_ENGINE_EMPTY";
    throw err;
  }

  return {
    authorize(req: HandshakeRequest): HandshakeDecision {
      for (const r of engine.rules) {
        if (r.applies(req)) return r.decide(req);
      }
      // If we got here, the engine configuration is invalid for v1.
      const err = new Error("POLICY_NO_MATCH");
      // @ts-expect-error attach metadata
      err.code = "POLICY_NO_MATCH";
      // @ts-expect-error attach metadata
      err.meta = { rule_count: engine.rules.length };
      throw err;
    },
  };
}

// POLICY_BINDING_V1_LOCKED
`;

// Write binding file (idempotent)
ensureFile(BINDING, bindingTs);

// ------------------------------
// Export from sentinel-core index.ts (explicit, no star)
// ------------------------------
const idxPrev = read(SENTINEL_INDEX);
const wantExportLine = `export { createGovernanceGatewayV1 } from "./policy_binding_v1.js";`;
const wantTypesLine = `export type { PolicyEngine, PolicyRule } from "./policy_binding_v1.js";`;

let idxNext = idxPrev;

// Add a small header marker once (optional, harmless if repeated)
if (!idxNext.includes("/* POLICY_BINDING_SURFACE_V1 */")) {
  idxNext = `/* POLICY_BINDING_SURFACE_V1 */\n` + idxNext;
}

// Ensure explicit exports exist
if (!idxNext.includes(wantExportLine)) idxNext = idxNext.trimEnd() + `\n${wantTypesLine}\n${wantExportLine}\n`;
if (!idxNext.includes(wantTypesLine)) idxNext = idxNext.replace(wantExportLine, `${wantTypesLine}\n${wantExportLine}`);

// Guardrail: refuse to introduce star exports
if (/^\s*export\s+\*\s+from\s+/m.test(idxNext)) {
  throw new Error("Invariant: sentinel-core index.ts contains star exports (disallowed).");
}

writeIfChanged(SENTINEL_INDEX, idxNext.trimEnd() + "\n");

// ------------------------------
// Add audit gate script (shell) to freeze policy binding surface
// ------------------------------
const auditSh = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

IDX="packages/sentinel-core/src/index.ts"

if ! test -f "$IDX"; then
  echo "FAIL: missing sentinel-core index: $IDX" >&2
  exit 1
fi

# 1) Must explicitly export binding symbols (no hidden/deep imports)
grep -q 'createGovernanceGatewayV1' "$IDX" || { echo "FAIL: sentinel-core index.ts must export createGovernanceGatewayV1" >&2; exit 1; }
grep -q 'PolicyEngine' "$IDX" || { echo "FAIL: sentinel-core index.ts must export PolicyEngine type" >&2; exit 1; }
grep -q 'PolicyRule' "$IDX" || { echo "FAIL: sentinel-core index.ts must export PolicyRule type" >&2; exit 1; }

# 2) No star exports in sentinel-core public surface
if grep -Eq '^\\s*export\\s+\\*\\s+from\\s+' "$IDX"; then
  echo "FAIL: sentinel-core index.ts must not contain star exports" >&2
  exit 1
fi

echo "OK: sentinel-core policy binding frozen surface audit passed."
`;

ensureFile(AUDIT, auditSh);
fs.chmodSync(AUDIT, 0o755);

// ------------------------------
// Wire audit into existing test chain (minimal, idempotent)
// We append to scripts/audit_sentinel_core_frozen_surface.sh if present.
// ------------------------------
const coreAudit = "scripts/audit_sentinel_core_frozen_surface.sh";
if (fs.existsSync(coreAudit)) {
  const prev = read(coreAudit);
  if (!prev.includes("audit_sentinel_policy_binding_frozen_surface.sh")) {
    const next = prev.trimEnd() + `\n./scripts/audit_sentinel_policy_binding_frozen_surface.sh\n`;
    writeIfChanged(coreAudit, next.trimEnd() + "\n");
  }
}

// ------------------------------
// Gates (must end with npm run build)
// ------------------------------
console.log("OK: Step 8 policy execution binding v1 locked (sentinel-core surface + audit).");

run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
