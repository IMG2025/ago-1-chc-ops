#!/usr/bin/env node
/**
 * Phase 21A — Capabilities contract version
 * - Adds contractVersion: "21A.1.0" to capabilitiesPayload()
 * - Idempotent
 * - Required gates: node --check + npm run build
 */

import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "services/mcp-shared-server/server.mjs";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const src = fs.readFileSync(FILE, "utf8");

// Idempotency gate
if (src.includes('contractVersion: "21A.1.0"')) {
  console.log("No changes needed: contractVersion already present.");
} else {
  const needle = 'schema: "mcp.capabilities.v1",';
  if (!src.includes(needle)) {
    throw new Error("Anchor not found: capabilities schema line");
  }

  const next = src.replace(
    needle,
    `${needle}\n    contractVersion: "21A.1.0",`
  );

  fs.writeFileSync(FILE, next);
  console.log("Patched:", FILE);
}

// Required gates
console.log("== Syntax check (required gate) ==");
run(`node --check ${FILE}`);

console.log("== Running build (required gate) ==");
run("npm run build");
