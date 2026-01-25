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
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPTS_DIR = "scripts";
const ATTIC_DIR = path.join(SCRIPTS_DIR, "_attic", "step-8");
ensureDir(ATTIC_DIR);

const canonicalKeep = new Set([
  "patch_step_8_lock_policy_execution_binding_v1.mjs",
  "patch_step_8_termux_bridge_handshake_types_v1.mjs",
  // We will fold regex fix into the bridge script, so this becomes redundant:
  // "patch_step_8_fix_termux_bridge_regex_literal_v1.mjs",
]);

const moveToAttic = [
  "patch_step_8_fix_sentinel_core_nexus_dep_v1.mjs",
  "patch_step_8_fix_workspace_protocol_unsupported_v1.mjs",
  "patch_step_8_termux_npm_workspace_recovery_v1.mjs",
  "patch_step_8_harden_termux_bridge_idempotency_v1.mjs",
  "patch_step_8_harden_termux_bridge_idempotency_v2.mjs",
  "patch_step_8_fix_termux_bridge_regex_literal_v1.mjs",
];

function safeMove(rel) {
  const src = path.join(SCRIPTS_DIR, rel);
  if (!exists(src)) return false;
  const dst = path.join(ATTIC_DIR, rel);
  ensureDir(path.dirname(dst));
  if (!exists(dst)) {
    fs.renameSync(src, dst);
  } else {
    // Already moved in a prior run; remove duplicate at source if it exists
    fs.rmSync(src, { force: true });
  }
  return true;
}

// ------------------------------
// 1) Fold regex-literal fix into the bridge script (idempotent)
// ------------------------------
const bridgeScript = path.join(SCRIPTS_DIR, "patch_step_8_termux_bridge_handshake_types_v1.mjs");
if (!exists(bridgeScript)) {
  throw new Error(`Invariant: missing ${bridgeScript}`);
}
let bridgeSrc = read(bridgeScript);

// If the bridge script contains an inline regex literal for the import rewrite,
// convert it to a RegExp constructor to avoid delimiter/escape brittleness.
if (!bridgeSrc.includes("new RegExp(")) {
  // Conservative transform: only if the script is doing prevBinding.replace( /import...@chc\/nexus-core.../m, ...)
  // We replace that statement with a RegExp-constructor variant.
  const needle = "const nextBinding = prevBinding.replace(";
  const i = bridgeSrc.indexOf(needle);
  if (i !== -1) {
    const after = bridgeSrc.slice(i);
    const endStmt = after.indexOf(");");
    if (endStmt !== -1) {
      const stmt = after.slice(0, endStmt + 2);
      if (stmt.includes("@chc") && stmt.includes("nexus-core") && stmt.includes("/import")) {
        const replacementStatement =
`const nextBinding = prevBinding.replace(
    new RegExp(String.raw\`import\\\\s+type\\\\s+\\\\{\\\\s*GovernanceGateway\\\\s*,\\\\s*HandshakeDecision\\\\s*,\\\\s*HandshakeRequest\\\\s*\\\\}\\\\s+from\\\\s+["']@chc\\\\/nexus-core["'];\\\\s*\`, "m"),
    bridgeImport
  );`;
        bridgeSrc = bridgeSrc.slice(0, i) + replacementStatement + bridgeSrc.slice(i + stmt.length);
      }
    }
  }
}

// Ensure the bridge script itself is idempotent around the import rewrite.
// If already bridged, do nothing; if still @chc/nexus-core, rewrite; otherwise fail.
if (!bridgeSrc.includes("Idempotent rewrite:")) {
  const H3 = "// 3) Rewrite policy_binding_v1.ts to import from local bridge (no @chc/nexus-core)";
  const H4 = "// 4) Add an audit to ensure the bridge stays in sync and no forbidden imports reappear";
  const i3 = bridgeSrc.indexOf(H3);
  const i4 = bridgeSrc.indexOf(H4);
  if (i3 !== -1 && i4 !== -1 && i4 > i3) {
    const section3 =
`${H3}
// ------------------------------
const prevBinding = read(BINDING);

// Idempotent rewrite:
// - If already bridged, do nothing.
// - If still importing @chc/nexus-core, rewrite.
// - Otherwise fail (unknown state).
const bridgeImport = \`import type { GovernanceGateway, HandshakeDecision, HandshakeRequest } from "./nexus_handshake_bridge_v1.js";\\n\`;

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
    new RegExp(String.raw\`import\\\\s+type\\\\s+\\\\{\\\\s*GovernanceGateway\\\\s*,\\\\s*HandshakeDecision\\\\s*,\\\\s*HandshakeRequest\\\\s*\\\\}\\\\s+from\\\\s+["']@chc\\\\/nexus-core["'];\\\\s*\`, "m"),
    bridgeImport
  );
  if (nextBinding === prevBinding) {
    throw new Error("Invariant: expected @chc/nexus-core import shape not found in policy_binding_v1.ts.");
  }
  writeIfChanged(BINDING, nextBinding);
} else {
  throw new Error("Invariant: policy_binding_v1.ts is in an unknown import state (neither bridged nor @chc/nexus-core).");
}
`;
    const before = bridgeSrc.slice(0, i3);
    const after = bridgeSrc.slice(i4);
    bridgeSrc = before + section3 + "\n" + after;
  }
}

writeIfChanged(bridgeScript, bridgeSrc);

// ------------------------------
// 2) Move attempt scripts into attic (idempotent)
// ------------------------------
let moved = 0;
for (const s of moveToAttic) {
  if (safeMove(s)) moved += 1;
}

// ------------------------------
// 3) Attic README / manifest (idempotent)
// ------------------------------
const readme = path.join(ATTIC_DIR, "README.md");
const content =
`# Step 8 Attic

This directory contains non-canonical Step 8 recovery / attempt scripts that were useful during Termux hardening.
They are retained for forensic traceability but are not part of the canonical execution path.

## Canonical Step 8 scripts (kept in /scripts)
- patch_step_8_lock_policy_execution_binding_v1.mjs
- patch_step_8_termux_bridge_handshake_types_v1.mjs

## Rationale
- Reduce repo operational noise.
- Preserve auditability and provenance.
- Keep a single obvious “happy path” for repeatable execution in constrained environments.
`;
writeIfChanged(readme, content);

// ------------------------------
// 4) Prove idempotency + gates (must end with npm run build)
// ------------------------------
console.log(`OK: Step 8 governance hygiene consolidated. Moved ${moved} script(s) to ${ATTIC_DIR}.`);
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");
run("node scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs");
run("npm test");
run("npm run build");
