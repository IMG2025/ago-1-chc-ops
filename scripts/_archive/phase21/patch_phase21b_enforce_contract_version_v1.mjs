#!/usr/bin/env node
/**
 * Phase 21B — Enforce contractVersion on /tool calls (fail-closed)
 * - Idempotent
 * - Required gate: npm run build
 */
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

const SERVER = "services/mcp-shared-server/server.mjs";
const PKG = "package.json";
const SMOKE = "scripts/mcp_smoke_phase21b.mjs";

if (!exists(SERVER)) throw new Error("Missing: " + SERVER);
if (!exists(PKG)) throw new Error("Missing: " + PKG);

// ---------- Patch server: enforce ctx.contractVersion ----------
let src = read(SERVER);

// Discover current contract version from capabilitiesPayload() (Phase 21A already added it)
const m = src.match(/contractVersion:\s*"([^"]+)"/);
if (!m) throw new Error('Unsafe: could not find capabilities contractVersion in server.mjs');
const CONTRACT_VERSION = m[1];

// 21B: advertise optional ctx fields (additive, non-breaking)
if (!src.includes("optionalCtxFields:")) {
  src = src.replace(
    /schema:\s*"mcp\.capabilities\.v1",\s*\n\s*contractVersion:\s*"[^"]+",/m,
    (block) => block + `\n      optionalCtxFields: ["contractVersion"],`
  );
}

// 21B: enforce contractVersion inside handleToolCall (fail-closed)
const ENFORCE_SENTINEL = "/* PHASE21B_CONTRACT_ENFORCEMENT */";
if (!src.includes(ENFORCE_SENTINEL)) {
  // Insert right after ctx validation (after assertCtx(ctx) succeeds)
  const anchor =
`    try {
      assertCtx(ctx);
    } catch (e) {
      return toolError(res, 400, "BAD_REQUEST", e.message || "Invalid ctx.");
    }`;

  if (!src.includes(anchor)) {
    throw new Error("Unsafe: expected handleToolCall ctx-validation anchor not found.");
  }

  const enforcement =
`${anchor}

    ${ENFORCE_SENTINEL}
    // Fail-closed: all /tool calls must declare a contractVersion matching server capabilities.
    // This prevents silent drift between clients and server contracts.
    const expectedContractVersion = "${CONTRACT_VERSION}";
    if (!ctx.contractVersion || typeof ctx.contractVersion !== "string" || !ctx.contractVersion.trim()) {
      return toolError(
        res,
        400,
        "CONTRACT_VERSION_REQUIRED",
        "Missing ctx.contractVersion.",
        ctx.traceId,
        { expected: expectedContractVersion }
      );
    }
    if (ctx.contractVersion !== expectedContractVersion) {
      return toolError(
        res,
        409,
        "CONTRACT_VERSION_MISMATCH",
        "Unsupported ctx.contractVersion.",
        ctx.traceId,
        { expected: expectedContractVersion, got: ctx.contractVersion }
      );
    }`;

  src = src.replace(anchor, enforcement);
}

writeIfChanged(SERVER, src);
console.log("Patched:", SERVER);

// ---------- Add smoke21b ----------
const smokeSrc = `#!/usr/bin/env node
/**
 * Phase 21B smoke: contract enforcement
 * Verifies:
 *  - /capabilities exposes contractVersion
 *  - /tool rejects missing ctx.contractVersion (400 CONTRACT_VERSION_REQUIRED)
 *  - /tool rejects mismatched ctx.contractVersion (409 CONTRACT_VERSION_MISMATCH)
 *  - /tool accepts matching ctx.contractVersion
 */
import assert from "node:assert";

const BASE = process.env.MCP_BASE || "http://127.0.0.1:8787";

async function getJson(path) {
  const r = await fetch(BASE + path);
  const j = await r.json();
  return { status: r.status, j };
}

async function postTool(tool, ctx, args = {}) {
  const r = await fetch(BASE + "/tool", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tool, args, ctx })
  });
  const j = await r.json();
  return { status: r.status, j };
}

(async () => {
  // 1) Capabilities must expose contractVersion
  const cap = await getJson("/capabilities");
  assert.equal(cap.status, 200, "capabilities status");
  assert.equal(cap.j.ok, true, "capabilities ok");
  assert.equal(cap.j.schema, "mcp.capabilities.v1", "capabilities schema");
  assert(typeof cap.j.contractVersion === "string" && cap.j.contractVersion.trim(), "capabilities contractVersion present");
  const CV = cap.j.contractVersion;

  // 2) Missing contractVersion must fail-closed
  {
    const ctx = { tenant: "chc", actor: "smoke", purpose: "phase21b", classification: "internal", traceId: "t-21b-missing" };
    const res = await postTool("chc.artifact_registry.read", ctx, {});
    assert.equal(res.status, 400, "missing contractVersion status");
    assert.equal(res.j.ok, false, "missing contractVersion ok=false");
    assert.equal(res.j.error?.code, "CONTRACT_VERSION_REQUIRED", "missing contractVersion code");
  }

  // 3) Mismatch contractVersion must 409
  {
    const ctx = { tenant: "chc", actor: "smoke", purpose: "phase21b", classification: "internal", traceId: "t-21b-mismatch", contractVersion: "0.0.0" };
    const res = await postTool("chc.artifact_registry.read", ctx, {});
    assert.equal(res.status, 409, "mismatch contractVersion status");
    assert.equal(res.j.ok, false, "mismatch contractVersion ok=false");
    assert.equal(res.j.error?.code, "CONTRACT_VERSION_MISMATCH", "mismatch contractVersion code");
  }

  // 4) Matching contractVersion must succeed
  {
    const ctx = { tenant: "chc", actor: "smoke", purpose: "phase21b", classification: "internal", traceId: "t-21b-ok", contractVersion: CV };
    const res = await postTool("chc.artifact_registry.read", ctx, {});
    assert.equal(res.status, 200, "matching contractVersion status");
    assert.equal(res.j.ok, true, "matching contractVersion ok=true");
  }

  console.log(JSON.stringify({
    ok: true,
    phase: "21B",
    base: BASE,
    observed: { contractVersion: CV }
  }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
writeIfChanged(SMOKE, smokeSrc);
chmod755(SMOKE);
console.log("Added:", SMOKE);

// ---------- Wire package.json script ----------
const pkg = JSON.parse(read(PKG));
pkg.scripts ||= {};
if (!pkg.scripts["mcp:smoke21b"]) {
  pkg.scripts["mcp:smoke21b"] = "node scripts/mcp_smoke_phase21b.mjs";
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Patched:", PKG, "(added mcp:smoke21b)");
} else {
  console.log("No changes needed:", PKG, "(mcp:smoke21b present)");
}

// ---------- Required gates ----------
console.log("== Syntax check (required gate) ==");
run("node --check " + SERVER);

console.log("== Running build (required gate) ==");
run("npm run build");
