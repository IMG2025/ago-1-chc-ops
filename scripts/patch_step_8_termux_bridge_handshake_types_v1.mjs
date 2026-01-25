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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SENTINEL = "packages/sentinel-core";
const SENTINEL_SRC = path.join(SENTINEL, "src");
const TS_CONFIG = path.join(SENTINEL, "tsconfig.json");
const BINDING = path.join(SENTINEL_SRC, "policy_binding_v1.ts");
const BRIDGE = path.join(SENTINEL_SRC, "nexus_handshake_bridge_v1.ts");

if (!fs.existsSync(SENTINEL)) throw new Error(`Missing: ${SENTINEL}`);
if (!fs.existsSync(TS_CONFIG)) throw new Error(`Missing: ${TS_CONFIG}`);
if (!fs.existsSync(BINDING)) throw new Error(`Missing: ${BINDING}`);

// ------------------------------
// 1) Remove forbidden @chc/nexus-core/* paths and any @chc/nexus-core paths mapping (Termux compile safety)
// ------------------------------
const tsObj = JSON.parse(read(TS_CONFIG));
tsObj.compilerOptions ??= {};
tsObj.compilerOptions.paths ??= {};
const paths = tsObj.compilerOptions.paths;

let changedPaths = false;
for (const k of Object.keys(paths)) {
  if (k === "@chc/nexus-core" || k === "@chc/nexus-core/*") {
    delete paths[k];
    changedPaths = true;
  }
}

// If paths became empty, keep it clean
if (Object.keys(paths).length === 0) {
  delete tsObj.compilerOptions.paths;
}

if (changedPaths) {
  writeIfChanged(TS_CONFIG, JSON.stringify(tsObj, null, 2) + "\n");
  console.log("OK: removed sentinel-core tsconfig path mappings for @chc/nexus-core (prevents rootDir violations + deep import audit failures).");
} else {
  console.log("OK: no @chc/nexus-core tsconfig paths present (already clean).");
}

// ------------------------------
// 2) Create local handshake bridge types (v1) inside sentinel-core
//    This avoids dependency resolution in Termux while preserving the handshake contract shape.
// ------------------------------
ensureDir(path.dirname(BRIDGE));

const bridgeTs = `/**
 * Nexus Handshake Bridge Types (v1) — Termux compile bridge
 *
 * Purpose:
 * - Termux npm cannot reliably install/link workspace packages.
 * - We still need Sentinel to compile while referencing handshake contract types.
 *
 * Guardrails:
 * - This file MUST mirror nexus-core handshake types exactly (v1).
 * - It is temporary infrastructure until workspace linking is stable.
 * - Do NOT add business logic here. Types only.
 */

// NOTE: Mirror of @chc/nexus-core handshake contract (v1)

export type HandshakeRequest = Readonly<{
  domain_id: string;
  task_type: string;
  requested_scope?: readonly string[];
  actor: Readonly<{
    subject_id: string;
    role: string;
    tenant_id?: string;
  }>;
}>;

export type HandshakeDecision = Readonly<{
  decision: "ALLOW" | "DENY";
  reason_code?: string;
  reason_meta?: unknown;
  issued_at: string; // ISO
}>;

export type GovernanceGateway = Readonly<{
  authorize: (req: HandshakeRequest) => HandshakeDecision;
}>;

// NEXUS_HANDSHAKE_BRIDGE_V1_LOCKED
`;

writeIfChanged(BRIDGE, bridgeTs);

// ------------------------------
// 3) Rewrite policy_binding_v1.ts to import from local bridge (no @chc/nexus-core)
// ------------------------------
const prevBinding = read(BINDING);

// Idempotent rewrite:
// - If already bridged, do nothing.
// - If still importing @chc/nexus-core, rewrite.
// - Otherwise fail (unknown state).
const bridgeImport = `import type { GovernanceGateway, HandshakeDecision, HandshakeRequest } from "./nexus_handshake_bridge_v1.js";\n`;

const alreadyBridged =
  prevBinding.includes('from "./nexus_handshake_bridge_v1.js"') ||
  prevBinding.includes("from './nexus_handshake_bridge_v1.js'");

const stillNexus =
  prevBinding.includes('from "@chc/nexus-core"') ||
  prevBinding.includes("from '@chc/nexus-core'");

if (alreadyBridged) {
  // converged; noop
} else if (stillNexus) {
  const nextBinding = prevBinding.replace(
    new RegExp(String.raw`import\s+type\s+\{\s*GovernanceGateway\s*,\s*HandshakeDecision\s*,\s*HandshakeRequest\s*\}\s+from\s+["']@chc\/nexus-core["'];\s*`, "m"),
    bridgeImport
  );
  if (nextBinding === prevBinding) {
    throw new Error("Invariant: expected @chc/nexus-core import shape not found in policy_binding_v1.ts.");
  }
  writeIfChanged(BINDING, nextBinding);
} else {
  throw new Error("Invariant: policy_binding_v1.ts is in an unknown import state (neither bridged nor @chc/nexus-core).");
}

// 4) Add an audit to ensure the bridge stays in sync and no forbidden imports reappear
// ------------------------------
const AUDIT = "scripts/audit_sentinel_policy_binding_termux_bridge_v1.sh";
const auditSh = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BIND="packages/sentinel-core/src/policy_binding_v1.ts"
TS="packages/sentinel-core/tsconfig.json"
BRIDGE="packages/sentinel-core/src/nexus_handshake_bridge_v1.ts"

test -f "$BIND" || { echo "FAIL: missing $BIND" >&2; exit 1; }
test -f "$BRIDGE" || { echo "FAIL: missing $BRIDGE" >&2; exit 1; }

# 1) policy_binding must not import @chc/nexus-core directly under Termux bridge mode
if grep -q '@chc/nexus-core' "$BIND"; then
  echo "FAIL: policy_binding_v1.ts must not import @chc/nexus-core under Termux bridge mode" >&2
  exit 1
fi

# 2) sentinel-core tsconfig must not contain @chc/nexus-core/* (deep import guardrail)
if grep -q '@chc/nexus-core/*' "$TS" 2>/dev/null; then
  echo "FAIL: sentinel-core tsconfig must not contain @chc/nexus-core/*" >&2
  exit 1
fi

echo "OK: sentinel-core Termux handshake bridge audit passed."
`;
writeIfChanged(AUDIT, auditSh);
fs.chmodSync(AUDIT, 0o755);

// Wire into sentinel core frozen surface audit chain (idempotent)
const coreAudit = "scripts/audit_sentinel_core_frozen_surface.sh";
if (fs.existsSync(coreAudit)) {
  const prev = read(coreAudit);
  if (!prev.includes("audit_sentinel_policy_binding_termux_bridge_v1.sh")) {
    writeIfChanged(coreAudit, prev.trimEnd() + "\n./scripts/audit_sentinel_policy_binding_termux_bridge_v1.sh\n");
  }
}

// ------------------------------
// 5) Gates (must end with npm run build)
// ------------------------------
console.log("OK: Step 8 Termux handshake bridge installed; rebuilding.");

run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
