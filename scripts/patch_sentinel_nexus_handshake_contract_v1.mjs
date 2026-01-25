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
  try { fs.chmodSync(filePath, 0o755); } catch { /* noop */ }
}

// ---- required baseline ----
mustExist("packages/nexus-core/package.json");
const NEXUS_INDEX = mustExist("packages/nexus-core/src/index.ts");
const ROOT_PKG = mustExist("package.json");

// =======================================================
// A) Create canonical handshake contract (v1)
// =======================================================
const HANDSHAKE = path.join(ROOT, "packages/nexus-core/src/handshake.ts");

const handshakeOut = `/**
 * Sentinel ↔ Nexus Handshake Contract (v1)
 *
 * Purpose:
 * - Provide a stable seam between Sentinel (governance/authorization + executor registry)
 *   and Nexus (orchestration/routing).
 *
 * Guardrails:
 * - Types-first boundary. Avoid runtime coupling to Sentinel internals.
 * - No deep imports. Consumers must import from "@chc/sentinel-core" and "@chc/nexus-core" only.
 * - Do NOT broaden this surface without adding an explicit v2 file and migration plan.
 */

import type { ExecutorSpec, TaskType } from "@chc/sentinel-core";

/**
 * Nexus operates on an envelope; Sentinel authorizes + validates based on domain/task/scope.
 * We intentionally keep payload unknown to prevent coupling.
 */
export interface NexusTaskEnvelope {
  task_id: string;
  domain_id: string;
  task_type: TaskType | string;
  payload: unknown;
  scopes?: readonly string[];
  meta?: Readonly<Record<string, unknown>>;
}

/**
 * Sentinel-facing registrar callback. Nexus uses this shape to mount plugins.
 * This mirrors plugin authoring style: register(spec).
 */
export type SentinelRegistrar = (spec: ExecutorSpec) => void;

/**
 * Minimal Sentinel capabilities Nexus is allowed to depend on.
 * This is the "governance gate + registry lookup" seam.
 */
export interface SentinelGateway {
  /**
   * Register a domain executor specification into Sentinel.
   * MUST enforce Sentinel invariants (scope namespace rules, subset gates, etc.) within Sentinel.
   */
  registerExecutor(spec: ExecutorSpec): void;

  /**
   * Authorize a task execution path.
   * Sentinel owns the rules. Nexus treats the return value as opaque.
   * If authorization fails, Sentinel MUST throw a typed error.
   */
  authorize(domain_id: string, task: unknown, scope: string): unknown;

  /**
   * Retrieve a registered executor spec by domain.
   * Nexus uses this to route calls after authorization.
   */
  get(domain_id: string): ExecutorSpec | undefined;

  /**
   * List mounted domains for diagnostics.
   */
  listDomains(): readonly string[];
}

/**
 * Nexus-facing plugin mount function.
 * This is the only supported "mount" integration seam:
 * Sentinel (or CHC Ops runtime) supplies a registrar callback, plugins call register(spec).
 */
export type NexusMountFn = (register: SentinelRegistrar) => void;

/**
 * Optional helper: mount plugins into a SentinelGateway.
 * This is intentionally tiny; most behavior lives in Sentinel.
 */
export function mountPluginsIntoSentinel(gateway: Pick<SentinelGateway, "registerExecutor">, mount: NexusMountFn): void {
  mount((spec) => gateway.registerExecutor(spec));
}
`;

writeIfChanged(HANDSHAKE, handshakeOut + "\n");

// =======================================================
// B) Canonicalize nexus-core index.ts to export handshake
//    (No export*)
// =======================================================
let idx = fs.readFileSync(NEXUS_INDEX, "utf8");

// Remove any star exports in nexus-core index (hard guard)
idx = idx.replace(/^\s*export\s+\*\s+from\s+["'][^"']+["'];\s*$/gm, "").trimEnd() + "\n";

// Ensure we export handshake types explicitly (idempotent)
const wants = [
  `export type { NexusTaskEnvelope, SentinelRegistrar, SentinelGateway, NexusMountFn } from "./handshake.js";`,
  `export { mountPluginsIntoSentinel } from "./handshake.js";`,
];

for (const line of wants) {
  if (!idx.includes(line)) idx += "\n" + line + "\n";
}

writeIfChanged(NEXUS_INDEX, idx.trimEnd() + "\n");

// =======================================================
// C) Add audit: handshake + nexus public surface frozen
// =======================================================
const AUDIT_HANDSHAKE = path.join(ROOT, "scripts/audit_sentinel_nexus_handshake_frozen_surface.sh");
const auditHandshakeOut = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
PKG="$ROOT/packages/nexus-core"

HANDSHAKE="$PKG/src/handshake.ts"
INDEX="$PKG/src/index.ts"

if [[ ! -f "$HANDSHAKE" ]]; then
  echo "FAIL: missing $HANDSHAKE"
  exit 1
fi
if [[ ! -f "$INDEX" ]]; then
  echo "FAIL: missing $INDEX"
  exit 1
fi

# 1) No star exports anywhere in nexus-core/src (belt + suspenders)
if grep -R --line-number -E '^\\s*export\\s+\\*\\s+from\\s+' "$PKG/src" >/tmp/nexus_star_exports.txt 2>/dev/null; then
  echo "---- offending export * lines ----"
  cat /tmp/nexus_star_exports.txt
  echo "FAIL: nexus-core must not use 'export * from ...'"
  exit 1
fi

# 2) Handshake must remain v1-labeled and must not deep-import sentinel internals.
if ! grep -q 'Handshake Contract (v1)' "$HANDSHAKE"; then
  echo "FAIL: handshake missing v1 header guard"
  exit 1
fi

# Disallow deep imports into sentinel-core internals:
# - "@chc/sentinel-core/" (anything after slash)
if grep -R --line-number -E '@chc/sentinel-core/' "$HANDSHAKE" >/tmp/handshake_deep_imports.txt 2>/dev/null; then
  echo "---- offending deep import lines ----"
  cat /tmp/handshake_deep_imports.txt
  echo "FAIL: handshake must not deep-import sentinel-core. Use '@chc/sentinel-core' only."
  exit 1
fi

# 3) Ensure nexus index exports handshake explicitly (surface lock)
if ! grep -q 'from "./handshake.js"' "$INDEX"; then
  echo "FAIL: nexus-core index.ts must export handshake surface explicitly"
  exit 1
fi

echo "OK: sentinel↔nexus handshake frozen surface audit passed."
`;

writeIfChanged(AUDIT_HANDSHAKE, auditHandshakeOut + "\n");
ensureExecutable(AUDIT_HANDSHAKE);

// =======================================================
// D) Wire audit into root npm test (idempotent)
// =======================================================
let pkgRaw = fs.readFileSync(ROOT_PKG, "utf8");
let pkg;
try {
  pkg = JSON.parse(pkgRaw);
} catch {
  throw new Error("Root package.json is not valid JSON");
}
pkg.scripts = pkg.scripts || {};
const testCmd = String(pkg.scripts.test || "").trim();
if (!testCmd) throw new Error("Root package.json scripts.test is missing/empty");

const INSERT = "./scripts/audit_sentinel_nexus_handshake_frozen_surface.sh";

function ensureInChain(cmd, insert) {
  if (cmd.includes(insert)) return cmd;
  // place after nexus audits if present, otherwise after sentinel audits, else prepend
  const anchors = [
    "./scripts/audit_nexus_core_frozen_surface.sh",
    "./scripts/audit_sentinel_core_frozen_surface.sh",
  ];
  for (const a of anchors) {
    if (cmd.includes(a)) return cmd.replace(a, `${a} && ${insert}`);
  }
  return `${insert} && ${cmd}`.trim();
}

const nextTest = ensureInChain(testCmd, INSERT);
if (nextTest !== testCmd) {
  pkg.scripts.test = nextTest;
  writeIfChanged(ROOT_PKG, JSON.stringify(pkg, null, 2) + "\n");
}

console.log("OK: Step 5 handshake contract v1 applied + audit wired.");

// =======================================================
// E) Gates (must end green)
// =======================================================
run("npm test");
run("npm run build");
