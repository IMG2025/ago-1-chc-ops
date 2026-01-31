#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

/* ------------------------------------------------------------------ */
/* 1. Forward-patch smoke20: add ctx.contractVersion (>=21A)           */
/* ------------------------------------------------------------------ */
const SMOKE20 = "scripts/mcp_smoke_phase20.mjs";
if (!exists(SMOKE20)) throw new Error("Missing " + SMOKE20);

let s20 = read(SMOKE20);

// Inject contractVersion into any ctx literal
s20 = s20.replace(
  /ctx:\s*\{([^}]+)\}/g,
  (m, inner) => {
    if (/contractVersion\s*:/.test(inner)) return m;
    return `ctx: { ${inner}, contractVersion: "21A.1.0" }`;
  }
);

// Ensure args is always present
s20 = s20.replace(
  /\{\s*tool:\s*([^\s,}]+)\s*,\s*ctx:/g,
  `{ tool: $1, args: {}, ctx:`
);

writeIfChanged(SMOKE20, s20);
chmod755(SMOKE20);
console.log("✔ smoke20 forward-patched for contractVersion");

/* ------------------------------------------------------------------ */
/* 2. Enforce minContractVersion on a real tool (authoritative)        */
/* ------------------------------------------------------------------ */
const SERVER = "services/mcp-shared-server/server.mjs";
if (!exists(SERVER)) throw new Error("Missing " + SERVER);

let srv = read(SERVER);

// Hard-gate shared.search (deterministic probe tool)
srv = srv.replace(
  /("shared\.artifact_registry\.search"\s*:\s*\{[\s\S]*?description:[^\n]+,)/m,
  (m) => {
    if (m.includes("minContractVersion")) return m;
    return m + `\n      minContractVersion: "21C.1.0",`;
  }
);

writeIfChanged(SERVER, srv);
console.log("✔ shared.artifact_registry.search min-gated @21C.1.0");

/* ------------------------------------------------------------------ */
/* 3. Make smoke21c hit that gate with an OLD client version           */
/* ------------------------------------------------------------------ */
const SMOKE21C = "scripts/mcp_smoke_phase21c.mjs";
if (!exists(SMOKE21C)) throw new Error("Missing " + SMOKE21C);

let s21c = read(SMOKE21C);

if (!s21c.includes("CLIENT_CONTRACT_VERSION")) {
  s21c = s21c.replace(
    /const\s+BASE\s*=/,
    `const CLIENT_CONTRACT_VERSION = "0.0.0";\nconst BASE =`
  );
}

// Force the gated call
if (!s21c.includes("shared.artifact_registry.search")) {
  s21c += `

import assert from "node:assert/strict";

const res = await fetch(BASE + "/tool", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    tool: "shared.artifact_registry.search",
    args: { q: "" },
    ctx: {
      tenant: "chc",
      actor: "smoke",
      purpose: "test",
      classification: "public",
      traceId: "smoke21c-" + Date.now(),
      contractVersion: CLIENT_CONTRACT_VERSION
    }
  })
});

assert.equal(res.status, 409, "tool-min fail status");
`;
}

writeIfChanged(SMOKE21C, s21c);
chmod755(SMOKE21C);
console.log("✔ smoke21c now probes minContractVersion gate");

/* ------------------------------------------------------------------ */
/* Required gate                                                       */
/* ------------------------------------------------------------------ */
console.log("== Running build (required gate) ==");
run("npm run build");
