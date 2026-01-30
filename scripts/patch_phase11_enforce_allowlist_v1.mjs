#!/usr/bin/env node
/**
 * patch_phase11_enforce_allowlist_v1.mjs
 * Phase 11B:
 * - Ensure namespace allowlist enforcement occurs BEFORE TOOL_REGISTRY lookup.
 * - Adds toolError + NAMESPACE_ALLOWLIST_BY_TENANT + isToolAllowed if missing.
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) {
    fs.writeFileSync(p, next);
    console.log("Patched:", p);
    return true;
  }
  console.log("No changes needed; already applied.");
  return false;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);
let changed = false;

// 1) Ensure helpers exist (toolError + allowlist + isToolAllowed)
const needToolError = !src.includes("function toolError(");
const needAllowlist = !src.includes("NAMESPACE_ALLOWLIST_BY_TENANT");
const needIsToolAllowed = !src.includes("function isToolAllowed(");

if (needToolError || needAllowlist || needIsToolAllowed) {
  // Insert helpers right after assertCtx definition (most stable anchor in current server)
  const assertNeedle = "function assertCtx(ctx)";
  const aIdx = src.indexOf(assertNeedle);
  if (aIdx < 0) {
    console.error("Anchor not found: function assertCtx(ctx)");
    process.exit(1);
  }

  // Find end of assertCtx function by brace walk from its first "{"
  const braceStart = src.indexOf("{", aIdx);
  if (braceStart < 0) {
    console.error("Could not locate assertCtx body.");
    process.exit(1);
  }
  let i = braceStart;
  let depth = 0;
  let end = -1;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) {
    console.error("Could not locate end of assertCtx function.");
    process.exit(1);
  }

  const helpers = `

function toolError(res, status, code, message, traceId, details) {
  return json(res, status, {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(traceId ? { meta: { traceId } } : {})
  });
}

// Namespace allowlist by tenant (default-deny if tenant unknown)
const NAMESPACE_ALLOWLIST_BY_TENANT = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
};

function isToolAllowed(tool, ctx) {
  const allowed = NAMESPACE_ALLOWLIST_BY_TENANT[ctx?.tenant] || [];
  return allowed.some((prefix) => tool.startsWith(prefix));
}
`;

  // Only insert helpers if missing (idempotent)
  if (!src.includes("NAMESPACE_ALLOWLIST_BY_TENANT") || !src.includes("function isToolAllowed(") || !src.includes("function toolError(")) {
    src = src.slice(0, end) + helpers + src.slice(end);
    changed = true;
  }
}

// 2) Enforce allowlist immediately after assertCtx(ctx); inside /tool handler
const toolRouteNeedle = 'if (req.method === "POST" && parsed.pathname === "/tool")';
const tIdx = src.indexOf(toolRouteNeedle);
if (tIdx < 0) {
  console.error("Anchor not found: /tool route");
  process.exit(1);
}

const assertCallNeedle = "assertCtx(ctx);";
const acIdx = src.indexOf(assertCallNeedle, tIdx);
if (acIdx < 0) {
  console.error("Anchor not found in /tool handler: assertCtx(ctx);");
  process.exit(1);
}

const guard = `
        if (!isToolAllowed(tool, ctx)) {
          return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
        }
`;

if (!src.includes('code, "FORBIDDEN"') && !src.includes("Tool not allowed for tenant")) {
  const insertAt = acIdx + assertCallNeedle.length;
  src = src.slice(0, insertAt) + guard + src.slice(insertAt);
  changed = true;
}

// 3) Ensure unknown tool returns TOOL_NOT_FOUND (optional hardening; won’t break anything)
if (!src.includes('"TOOL_NOT_FOUND"') && src.includes('return json(res, 404, { ok: false, error: { message: "Unknown tool" } });')) {
  src = src.replace(
    'return json(res, 404, { ok: false, error: { message: "Unknown tool" } });',
    'return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx.traceId, { tool });'
  );
  changed = true;
}

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
