#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const SHARED_ARTIFACTS_PATH = "/data/data/com.termux/files/home/work/ago-1-chc-ops/data/artifacts.shared.json";

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function badRequest(res, message, traceId) {
  return json(res, 400, { ok: false, error: { code: "BAD_REQUEST", message }, meta: traceId ? { traceId } : undefined });
}

function toolError(res, status, code, message, traceId, details) {
  return json(res, status, {
    ok: false,
    error: { code, message, details },
    meta: traceId ? { traceId } : undefined
  });
}

// == MCP tool registry (Phase 7) ==
const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the shared artifact registry (read-only bootstrap tool).",
    // Minimal JSON-schema-ish descriptors (tool-meta.v1)
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
    },
    handler: async ({ ctx }) => {
      const data = readJson(SHARED_ARTIFACTS_PATH);
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  }
};

// Default allowlist by tenant (tighten over time; default-deny elsewhere)
// Phase 8: registry/introspection schema
const MCP_TOOLS_REGISTRY_SCHEMA = "mcp.tools-registry.v1";
const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
const TOOL_META_SCHEMA_VERSION = "tool-meta.v1";

const TENANT_NAMESPACE_ALLOWLIST = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
};

function assertCtx(ctx) {
  const required = REQUIRED_CTX_FIELDS;
  for (const k of required) {
    if (!ctx || typeof ctx[k] !== "string" || !ctx[k].trim()) {
      const err = new Error(`Invalid ctx: missing ${k}`);
      err.statusCode = 400;
      throw err;
    }
  }
}

function isToolAllowed(tool, ctx) {
  const allowed = TENANT_NAMESPACE_ALLOWLIST[ctx.tenant] || [];
  return allowed.some((prefix) => tool.startsWith(prefix));
}

function handleToolCall(_req, res, body) {
  const { tool, args, ctx } = body || {};

  if (!tool || typeof tool !== "string") return badRequest(res, "Missing tool (string).");
  if (args === undefined || args === null || typeof args !== "object") return badRequest(res, "Missing args (object).");
  if (!ctx || typeof ctx !== "object") return badRequest(res, "Missing ctx (object).");

  try {
    assertCtx(ctx);
  } catch (e) {
    return badRequest(res, e?.message || "Invalid ctx.", ctx?.traceId);
  }

  if (!isToolAllowed(tool, ctx)) {
    return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
  }

  const entry = TOOL_REGISTRY[tool];
  if (!entry) {
    return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx.traceId, { tool });
  }

  Promise.resolve()
    .then(() => entry.handler({ tool, args, ctx }))
    .then((data) => json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } }))
    .catch((e) => toolError(res, 500, "INTERNAL", e?.message || "Tool execution failed.", ctx.traceId));
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://localhost");
  const pathname = u.pathname;

  if (req.method === "GET" && pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && pathname === "/tools") {
    const tools = Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
      name,
      version: v?.version || "0.0.0",
      description: v?.description || "",
      metaSchema: TOOL_META_SCHEMA_VERSION,
      argsSchema: v?.argsSchema || { type: "object", additionalProperties: true },
      responseSchema: v?.responseSchema || { type: "object", additionalProperties: true }
    }));

    return json(res, 200, {
      ok: true,
      schema: MCP_TOOLS_REGISTRY_SCHEMA,
      requiredCtxFields: REQUIRED_CTX_FIELDS,
      tenants: Object.keys(TENANT_NAMESPACE_ALLOWLIST),
      namespaceAllowlistByTenant: TENANT_NAMESPACE_ALLOWLIST,
      tools
    });
  }

  if (req.method === "POST" && pathname === "/tool") {
    let buf = "";
    req.on("data", (chunk) => { buf += chunk; });
    req.on("end", () => {
      try {
        const parsed = buf ? JSON.parse(buf) : {};
        return handleToolCall(req, res, parsed);
      } catch {
        return badRequest(res, "Invalid JSON.");
      }
    });
    return;
  }

  return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
});

server.listen(PORT, () => {
  console.log(`mcp-shared-server listening on :${PORT}`);
  console.log("GET  /health");
  console.log("GET  /tools");
  console.log("POST /tool { tool, args, ctx }");
});
