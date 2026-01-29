#!/usr/bin/env node
/**
 * patch_mcp_server_tools_list_and_policy_v2.mjs
 * Phase 7A+7B for Node http server (NOT express):
 * - Add GET /tools for discoverability
 * - Introduce TOOL_REGISTRY
 * - Enforce ctx required fields + namespace allowlist
 * - Route /tool via registry handlers
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
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

const src = read(serverPath);

// --- 1) Ensure we’re patching the expected Node http server file ---
if (!src.includes("http.createServer") || !src.includes('parsed.pathname === "/tool"')) {
  console.error("Unexpected server.mjs shape; aborting to avoid corrupt patch.");
  process.exit(1);
}

// --- 2) Insert Phase 7 registry + policy helpers (idempotent) ---
let next = src;

const hasPhase7 = next.includes("== MCP tool registry (Phase 7) ==") && next.includes("const TOOL_REGISTRY");
if (!hasPhase7) {
  const insertAnchor = "function toolNotFound(res, tool)";
  const idx = next.indexOf(insertAnchor);
  if (idx < 0) {
    console.error("Could not find anchor:", insertAnchor);
    process.exit(1);
  }

  // Insert after toolNotFound() function ends (first closing brace after it)
  const braceIdx = next.indexOf("}", idx);
  if (braceIdx < 0) {
    console.error("Could not locate end of toolNotFound().");
    process.exit(1);
  }
  const insertPos = next.indexOf("\n", braceIdx) + 1;

  const block = `
// == MCP tool registry (Phase 7) ==
// Keep this server minimal; other domain servers can live elsewhere.
const SHARED_ARTIFACTS_PATH = path.join(ROOT, "data", "artifacts.shared.json");

const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    description: "Return the shared artifact registry (read-only bootstrap tool).",
    handler: async ({ args, ctx }) => {
      // NOTE: args currently unused (read-only).
      // We preserve the existing file format to avoid breaking Phase 6 consumers.
      const data = readJson(SHARED_ARTIFACTS_PATH);
      return data;
    }
  }
};

// Tight namespace allowlist per tenant (default-deny elsewhere)
const TENANT_NAMESPACE_ALLOWLIST = {
  shared: ["shared."],
  chc: ["shared."],
  ciag: ["shared."],
  hospitality: ["shared."]
};

function assertCtx(ctx) {
  const required = ["tenant", "actor", "purpose", "classification", "traceId"];
  for (const k of required) {
    if (!ctx || typeof ctx[k] !== "string" || !ctx[k].trim()) {
      const err = new Error(\`Invalid ctx: missing \${k}\`);
      err.statusCode = 400;
      throw err;
    }
  }
}

function isToolAllowed(tool, ctx) {
  const allowed = TENANT_NAMESPACE_ALLOWLIST[ctx.tenant] || [];
  return allowed.some((prefix) => tool.startsWith(prefix));
}

function toolError(res, status, code, message, traceId, details) {
  const body = {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(traceId ? { meta: { traceId } } : {})
  };
  return json(res, status, body);
}
`;
  next = next.slice(0, insertPos) + block + next.slice(insertPos);
}

// --- 3) Replace handleToolCall with Phase 7 policy+registry implementation (idempotent) ---
const handleRe = /function handleToolCall\s*\([\s\S]*?\n}\n\nconst server = http\.createServer/s;
const m = next.match(handleRe);
if (!m) {
  console.error("Could not locate handleToolCall() block for replacement.");
  process.exit(1);
}

const replacement = `function handleToolCall(req, res, body) {
  const { tool, args, ctx } = body || {};

  if (!tool || typeof tool !== "string") return badRequest(res, "Missing tool (string).");
  if (!args || typeof args !== "object") return badRequest(res, "Missing args (object).");
  if (!ctx || typeof ctx !== "object") return badRequest(res, "Missing ctx (object).");

  // Phase 7: hard ctx requirements
  try {
    assertCtx(ctx);
  } catch (e) {
    const status = e && typeof e.statusCode === "number" ? e.statusCode : 400;
    return toolError(res, status, "BAD_REQUEST", e?.message || "Invalid ctx.", ctx?.traceId);
  }

  // Tenant validity (preserve the existing allowed tenant set)
  if (ctx.tenant !== "shared" && ctx.tenant !== "chc" && ctx.tenant !== "ciag" && ctx.tenant !== "hospitality") {
    return toolError(res, 400, "BAD_REQUEST", "Invalid ctx.tenant.", ctx.traceId);
  }

  // Namespace allowlist
  if (!isToolAllowed(tool, ctx)) {
    return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
  }

  // Registry lookup
  const entry = TOOL_REGISTRY[tool];
  if (!entry) {
    return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx.traceId, { tool });
  }

  // Execute tool
  Promise.resolve()
    .then(() => entry.handler({ tool, args, ctx }))
    .then((data) => json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } }))
    .catch((e) => toolError(res, 500, "INTERNAL", e?.message || "Tool execution failed.", ctx.traceId));
}

const server = http.createServer`;

next = next.replace(handleRe, replacement);

// --- 4) Add GET /tools route (idempotent) ---
if (!next.includes('parsed.pathname === "/tools"')) {
  const healthAnchor = `if (req.method === "GET" && parsed.pathname === "/health") {`;
  const hi = next.indexOf(healthAnchor);
  if (hi < 0) {
    console.error("Could not find /health anchor to place /tools route near.");
    process.exit(1);
  }

  // Insert /tools right after the /health block’s closing brace
  const healthEnd = next.indexOf("}", hi);
  const healthEndLine = next.indexOf("\n", healthEnd) + 1;

  const toolsRoute = `  if (req.method === "GET" && parsed.pathname === "/tools") {
    const tools = Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
      name,
      description: (v && v.description) ? v.description : ""
    }));
    return json(res, 200, { ok: true, tools });
  }
`;
  next = next.slice(0, healthEndLine) + toolsRoute + next.slice(healthEndLine);
}

writeIfChanged(serverPath, next);

console.log("== Running build (required) ==");
run("npm run build");
