#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCRIPT = "scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs";
if (!fs.existsSync(SCRIPT)) throw new Error(`Missing: ${SCRIPT}`);

const src = read(SCRIPT);

// Marker headers (these should be stable in your Step 8 script)
const H3 = "// 3) Rewrite policy_binding_v1.ts to import from local bridge (no @chc/nexus-core)";
const H4 = "// 4) Add an audit to ensure the bridge stays in sync and no forbidden imports reappear";

const i3 = src.indexOf(H3);
const i4 = src.indexOf(H4);

if (i3 === -1 || i4 === -1 || i4 <= i3) {
  throw new Error(
    `Invariant: could not locate Step 8 rewrite section markers.\n` +
    `Expected markers:\n- ${H3}\n- ${H4}\n`
  );
}

// Build the new (idempotent) Section 3 block.
const section3 = `${H3}
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
    /import\\s+type\\s+\\{\\s*GovernanceGateway\\s*,\\s*HandshakeDecision\\s*,\\s*HandshakeRequest\\s*\\}\\s+from\\s+[\\\"\\']@chc\\\\/nexus-core[\\\"\\'];\\s*/m,
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

// Replace content from start of H3 to just before H4.
const before = src.slice(0, i3);
const after = src.slice(i4); // includes H4 marker line onward

// If already hardened (contains our signature), do nothing
const signature = "Idempotent rewrite:";
let next = src;
if (!src.includes(signature)) {
  next = before + section3 + "\n" + after;
  writeIfChanged(SCRIPT, next);
  console.log("OK: hardened Step 8 Termux bridge script (marker-based idempotency).");
} else {
  console.log("OK: Step 8 Termux bridge script already hardened (no changes).");
}

// Prove idempotency and gates (must end with npm run build)
run(`node ${SCRIPT}`);
run(`node ${SCRIPT}`);
run("npm test");
run("npm run build");
