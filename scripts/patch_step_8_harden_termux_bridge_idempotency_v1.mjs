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

// Replace the brittle rewrite block with an idempotent one.
// We match the section starting at "const prevBinding" through the throw block.
const pattern = /const prevBinding = read\\(BINDING\\);[\\s\\S]*?writeIfChanged\\(BINDING, nextBinding\\);/m;

const replacement = `const prevBinding = read(BINDING);

// Idempotent rewrite:
// - If already bridged, do nothing.
// - If still importing @chc/nexus-core, rewrite.
// - Otherwise fail (unknown state).
const bridgeImport = \`import type { GovernanceGateway, HandshakeDecision, HandshakeRequest } from "./nexus_handshake_bridge_v1.js";\\n\`;

if (prevBinding.includes('from "./nexus_handshake_bridge_v1.js"')) {
  // Already converged.
} else if (prevBinding.includes('from "@chc/nexus-core"') || prevBinding.includes("from '@chc/nexus-core'")) {
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
}`;

if (!pattern.test(src)) {
  throw new Error("Invariant: could not locate rewrite-import block to harden (script layout changed).");
}

const next = src.replace(pattern, replacement);
writeIfChanged(SCRIPT, next);

console.log("OK: hardened Step 8 Termux bridge script to be idempotent.");

// Prove idempotency and gates (must end with npm run build)
run(`node ${SCRIPT}`);
run(`node ${SCRIPT}`);
run("npm test");
run("npm run build");
