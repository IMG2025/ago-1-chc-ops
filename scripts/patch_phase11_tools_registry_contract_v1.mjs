#!/usr/bin/env node
/**
 * patch_phase11_tools_registry_contract_v1.mjs
 * Phase 11A:
 * - Upgrade GET /tools to authoritative registry contract: schema, requiredCtxFields, tenants, allowlists, tool schemas.
 * - Re-introduce namespace allowlist enforcement by tenant.
 * - Normalize /tool error shapes with stable codes + meta.traceId.
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

// ---------- 1) Ensure Phase 11 policy/constants exist (insert after TOOL_REGISTRY closing `};`) ----------
const phase11Marker = "PHASE_11_POLICY";
if (!src.includes(phase11Marker)) {
  const toolRegistryNeedle = "const TOOL_REGISTRY = {";
  const toolIdx = src.indexOf(toolRegistryNeedle);
  if (toolIdx < 0) {
    console.error("Anchor not found: TOOL_REGISTRY");
    process.exit(1);
  }

  // Find the end of TOOL_REGISTRY object (first occurrence of "\n};" after TOOL_REGISTRY start)
  const endIdx = src.indexOf("\n};", toolIdx);
  if (endIdx < 0) {
    console.error("Could not locate end of TOOL_REGISTRY block.");
    process.exit(1);
  }

  const insertAt = endIdx + "\n};".length;

  const policyBlock = `

/* ${phase11Marker}: authoritative tool registry contract + tenant allowlist */
const TOOLS_REGISTRY_SCHEMA = "mcp.tools-registry.v1";
const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
const TENANTS = ["shared", "chc", "ciag", "hospitality"];

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

function toolError(res, status, code, message, traceId, details) {
  return json(res, status, {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(traceId ? { meta: { traceId } } : {})
  });
}

// Tool metadata (args/response schemas) for /tools contract
const TOOL_META = {
  "shared.artifact_registry.read": {
    version: "1.0.0",
    metaSchema: "tool-meta.v1",
    argsSchema: {
      type: "object",
      additionalProperties: true,
      description: "No args required (reserved for future filtering)."
    },
    responseSchema: {
      type: "object",
      required: ["schema", "tenant", "generatedAt", "artifacts"],
      properties: {
        schema: { type: "string" },
        tenant: { type: "string" },
        generatedAt: { type: "string" },
        artifacts: { type: "array" }
      }
    }
  },
  "shared.artifact_registry.readById": {
    version: "1.0.0",
    metaSchema: "tool-meta.v1",
    argsSchema: {
      type: "object",
      additionalProperties: true,
      required: ["id"],
      properties: { id: { type: "string" } }
    },
    responseSchema: {
      type: "object",
      required: ["schema", "tenant", "id", "artifact"],
      properties: {
        schema: { type: "string" },
        tenant: { type: "string" },
        id: { type: "string" },
        artifact: {}
      }
    }
  },
  "shared.artifact_registry.search": {
    version: "1.0.0",
    metaSchema: "tool-meta.v1",
    argsSchema: {
      type: "object",
      additionalProperties: true,
      properties: { q: { type: "string" } }
    },
    responseSchema: {
      type: "object",
      required: ["schema", "tenant", "q", "count", "artifacts"],
      properties: {
        schema: { type: "string" },
        tenant: { type: "string" },
        q: { type: "string" },
        count: { type: "number" },
        artifacts: { type: "array" }
      }
    }
  }
};
`;

  src = src.slice(0, insertAt) + policyBlock + src.slice(insertAt);
  changed = true;
}

// ---------- 2) Replace GET /tools handler to return contract ----------
const toolsRouteNeedle = 'if (req.method === "GET" && parsed.pathname === "/tools") {';
const toolsIdx = src.indexOf(toolsRouteNeedle);
if (toolsIdx < 0) {
  console.error("Anchor not found: /tools route");
  process.exit(1);
}

// Replace the entire /tools block using a conservative scan to the matching closing brace at same indent.
function replaceBlock(startNeedle, buildReplacement) {
  const start = src.indexOf(startNeedle);
  if (start < 0) return false;

  // Find block start "{"
  const braceStart = src.indexOf("{", start);
  if (braceStart < 0) return false;

  // Walk braces to find matching close
  let i = braceStart;
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const blockEnd = i + 1;
        const before = src.slice(0, start);
        const after = src.slice(blockEnd);
        const repl = buildReplacement();
        src = before + repl + after;
        return true;
      }
    }
  }
  return false;
}

const toolsReplacement = () => `if (req.method === "GET" && parsed.pathname === "/tools") {
    const tools = Object.keys(TOOL_REGISTRY).sort().map((name) => {
      const meta = TOOL_META[name] || {};
      const desc = TOOL_REGISTRY[name]?.description || meta.description || "";
      return {
        name,
        version: meta.version || "1.0.0",
        description: desc,
        metaSchema: meta.metaSchema || "tool-meta.v1",
        argsSchema: meta.argsSchema || { type: "object", additionalProperties: true },
        responseSchema: meta.responseSchema || { type: "object", additionalProperties: true }
      };
    });

    return json(res, 200, {
      ok: true,
      schema: TOOLS_REGISTRY_SCHEMA,
      requiredCtxFields: REQUIRED_CTX_FIELDS,
      tenants: TENANTS,
      namespaceAllowlistByTenant: NAMESPACE_ALLOWLIST_BY_TENANT,
      tools
    });
  }`;

if (replaceBlock(toolsRouteNeedle, toolsReplacement)) changed = true;

// ---------- 3) Normalize /tool handler: ctx required + allowlist + stable error codes ----------
const toolRouteNeedle = 'if (req.method === "POST" && parsed.pathname === "/tool") {';
const toolIdx = src.indexOf(toolRouteNeedle);
if (toolIdx < 0) {
  console.error("Anchor not found: /tool route");
  process.exit(1);
}

// In the /tool handler, locate `assertCtx(ctx);` then ensure allowlist + coded errors exist.
if (!src.includes("isToolAllowed(tool, ctx)")) {
  // Insert allowlist check immediately after assertCtx(ctx);
  const assertNeedle = "assertCtx(ctx);";
  const aIdx = src.indexOf(assertNeedle, toolIdx);
  if (aIdx < 0) {
    console.error("Anchor not found in /tool handler: assertCtx(ctx)");
    process.exit(1);
  }
  const insertPoint = aIdx + assertNeedle.length;

  const allowlistGuard = `
        if (!isToolAllowed(tool, ctx)) {
          return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
        }`;

  src = src.slice(0, insertPoint) + allowlistGuard + src.slice(insertPoint);
  changed = true;
}

// Replace "Unknown tool" response with coded TOOL_NOT_FOUND (if present as plain message)
if (!src.includes('"TOOL_NOT_FOUND"')) {
  src = src.replace(
    /return json\(res,\s*404,\s*\{\s*ok:\s*false,\s*error:\s*\{\s*message:\s*"Unknown tool"\s*\}\s*\}\s*\);/g,
    `return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx?.traceId, { tool });`
  );
  // even if no match, harmless
}

// Normalize catch error response to BAD_REQUEST w/ traceId if ctx exists
if (!src.includes('"BAD_REQUEST"')) {
  src = src.replace(
    /return json\(res,\s*400,\s*\{\s*ok:\s*false,\s*error:\s*\{\s*message:\s*e\.message\s*\}\s*\}\s*\);/g,
    `return toolError(res, 400, "BAD_REQUEST", e?.message || "Bad request", (typeof ctx === "object" && ctx) ? ctx.traceId : undefined);`
  );
}

changed = writeIfChanged(serverPath, src) || changed;

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
