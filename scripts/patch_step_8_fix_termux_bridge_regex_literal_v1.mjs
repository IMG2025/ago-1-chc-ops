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

const TARGET = "scripts/patch_step_8_termux_bridge_handshake_types_v1.mjs";
if (!fs.existsSync(TARGET)) throw new Error(`Missing: ${TARGET}`);

const src = read(TARGET);

// We replace the brittle regex-literal replace() call with a RegExp-constructor version.
// This avoids slash escaping issues when scripts are generated/rewritten.
const NEEDLE = "const nextBinding = prevBinding.replace(";

if (!src.includes(NEEDLE)) {
  throw new Error("Invariant: expected binding rewrite block not found (const nextBinding = prevBinding.replace...).");
}

// If already fixed (RegExp constructor present), noop.
if (src.includes("new RegExp(") && src.includes("expected @chc/nexus-core import shape")) {
  console.log("OK: Step 8 bridge script already uses RegExp constructor (no changes).");
} else {
  // Replace only the replace() call that contains the regex literal for @chc/nexus-core import.
  // We do a conservative transform: find the first occurrence of prevBinding.replace( and rewrite that call body.
  const start = src.indexOf(NEEDLE);
  const afterStart = src.slice(start);

  // Find the end of that replace call by locating the closing ");" that ends the statement.
  const endIdxLocal = afterStart.indexOf(");");
  if (endIdxLocal === -1) throw new Error("Invariant: could not locate end of prevBinding.replace(...) statement.");

  const statement = afterStart.slice(0, endIdxLocal + 2); // includes ");
  // Only proceed if this statement references @chc/nexus-core (we don’t want to rewrite unrelated code).
  if (!statement.includes("@chc") || !statement.includes("nexus-core")) {
    throw new Error("Invariant: the first prevBinding.replace(...) does not appear to be the nexus-core import rewrite.");
  }

  const replacementStatement =
`const nextBinding = prevBinding.replace(
    new RegExp(String.raw\`import\\s+type\\s+\\{\\s*GovernanceGateway\\s*,\\s*HandshakeDecision\\s*,\\s*HandshakeRequest\\s*\\}\\s+from\\s+["']@chc\\/nexus-core["'];\\s*\`, "m"),
    bridgeImport
  );`;

  const next =
    src.slice(0, start) +
    replacementStatement +
    src.slice(start + statement.length);

  writeIfChanged(TARGET, next);
  console.log("OK: replaced regex literal with RegExp constructor in Step 8 bridge script.");
}

// Prove idempotency + gates (must end with npm run build)
run(`node ${TARGET}`);
run(`node ${TARGET}`);
run("npm test");
run("npm run build");
