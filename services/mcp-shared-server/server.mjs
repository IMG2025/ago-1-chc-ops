#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const SHARED_ARTIFACTS_PATH = path.join(ROOT, "data", "artifacts.shared.json");

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function assertCtx(ctx) {
  const required = ["tenant", "actor", "purpose", "classification", "traceId"];
  for (const k of required) {
    if (!ctx?.[k]) throw new Error("Invalid ctx: missing " + k);
  }
}

const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    description: "Return the shared artifact registry.",
    handler: async ({ ctx }) => {
      const data = JSON.parse(fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8"));
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  },

  "shared.artifact_registry.readById": {
    description: "Read artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = JSON.parse(fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8"));
      const artifact = (data.artifacts || []).find(a => a.id === args.id) || null;
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        id: args.id,
        artifact
      };
    }
  },

  "shared.artifact_registry.search": {
    description: "Search artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = JSON.parse(fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8"));
      const artifacts = data.artifacts || [];
      const hits = q
        ? artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q))
        : artifacts;
      return {
        schema: "artifact-registry.search.v1",
        tenant: ctx.tenant,
        q,
        count: hits.length,
        artifacts: hits
      };
    }
  }
};

/* PHASE_11_POLICY: authoritative tool registry contract + tenant allowlist */
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


const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
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
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", async () => {
      try {
        const { tool, args, ctx } = JSON.parse(buf || "{}");
        assertCtx(ctx);
        if (!isToolAllowed(tool, ctx)) {
          return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
        }

        const entry = TOOL_REGISTRY[tool];
        if (!entry) {
          return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx?.traceId, { tool });
        }
        const data = await entry.handler({ tool, args, ctx });
        return json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } });
      } catch (e) {
        return toolError(res, 400, "BAD_REQUEST", e?.message || "Bad request", (typeof ctx === "object" && ctx) ? ctx.traceId : undefined);
      }
    });
    return;
  }

  json(res, 404, { ok: false, error: { message: "Route not found" } });
});

server.listen(PORT, () => {
  console.log("mcp-shared-server listening on :" + PORT);
  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY));
});
