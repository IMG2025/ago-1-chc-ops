#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);

const TENANTS = ["shared", "chc", "ciag", "hospitality"];
const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];

const TENANT_NAMESPACE_ALLOWLIST = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
};


/* CANONICAL TENANT REGISTRY HELPER — LOCKED */
function readTenantRegistry(tenant = "shared") {
  const fp = TENANT_REGISTRY_PATHS[tenant];
  if (!fp) throw new Error("Unknown tenant: " + tenant);

  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  return {
    schema: raw.schema || "artifact-registry.v1",
    tenant: raw.tenant || tenant,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    artifacts: Array.isArray(raw.artifacts) ? raw.artifacts : []
  };
}
/* /CANONICAL TENANT REGISTRY HELPER */

const TENANT_REGISTRY_PATHS = {
  shared: path.join(ROOT, "data", "artifacts.shared.json"),
  chc: path.join(ROOT, "data", "artifacts.chc.json"),
  ciag: path.join(ROOT, "data", "artifacts.ciag.json"),
  hospitality: path.join(ROOT, "data", "artifacts.hospitality.json")
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function toolError(res, status, code, message, traceId, details) {
  return json(res, status, {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(traceId ? { meta: { traceId } } : {})
  });
}

function assertCtx(ctx) {
  for (const k of REQUIRED_CTX_FIELDS) {
    if (!ctx || typeof ctx[k] !== "string" || !ctx[k].trim()) {
      const msg = "Invalid ctx: missing " + k;
      const err = new Error(msg);
      // used only for message; callers return 400
      throw err;
    }
  }
  if (!TENANTS.includes(ctx.tenant)) {
    throw new Error("Invalid ctx: unknown tenant");
  }
}

function isToolAllowed(tool, tenant) {
  const allowed = TENANT_NAMESPACE_ALLOWLIST[tenant] || [];
  return allowed.some((prefix) => tool.startsWith(prefix));
}

function readRegistryFile(tenant) {
  const fp = TENANT_REGISTRY_PATHS[tenant];
  if (!fp) throw new Error("Unknown tenant: " + tenant);
  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  const artifacts = Array.isArray(raw.artifacts) ? raw.artifacts : [];
  return {
    schema: raw.schema || "artifact-registry.v1",
    tenant: raw.tenant || tenant,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    artifacts
  };
}

// == Tool registry (authoritative) ==
const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the shared artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("shared")
  },

  "shared.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read shared artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("shared");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },

  "shared.artifact_registry.search": {
    version: "1.0.0",
    description: "Search shared artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("shared");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },

  "chc.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the CHC tenant artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("chc")
  },

  "ciag.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the CIAG tenant artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("ciag")
  },

  "hospitality.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the Hospitality tenant artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("hospitality")
  }
};

function toolsPayload() {
  return Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
    name,
    version: v.version || "1.0.0",
    description: v.description || ""
  }));
}

function capabilitiesPayload() {
  return {
    ok: true,
    schema: "mcp.capabilities.v1",
    requiredCtxFields: REQUIRED_CTX_FIELDS.slice(),
    tenants: TENANTS.slice(),
    namespaceAllowlistByTenant: TENANT_NAMESPACE_ALLOWLIST,
    tools: toolsPayload()
  };
}

function handleToolCall(req, res, body) {
  const { tool, args, ctx } = body || {};
  if (!tool || typeof tool !== "string") return toolError(res, 400, "BAD_REQUEST", "Missing tool (string).");
  if (!args || typeof args !== "object") return toolError(res, 400, "BAD_REQUEST", "Missing args (object).");
  if (!ctx || typeof ctx !== "object") return toolError(res, 400, "BAD_REQUEST", "Missing ctx (object).");

  try {
    assertCtx(ctx);
  } catch (e) {
    return toolError(res, 400, "BAD_REQUEST", e.message || "Invalid ctx.");
  }

  if (!isToolAllowed(tool, ctx.tenant)) {
    return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
  }

  const entry = TOOL_REGISTRY[tool];
  if (!entry) {
    return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx.traceId, { tool });
  }

  Promise.resolve()
    .then(() => entry.handler({ tool, args, ctx }))
    .then((data) => json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } }))
    .catch((e) => toolError(res, 500, "INTERNAL", e && e.message ? e.message : "Tool execution failed.", ctx.traceId));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    return json(res, 200, { ok: true, schema: "mcp.tools-registry.v1", tools: toolsPayload() });
  }

  if (req.method === "GET" && parsed.pathname === "/capabilities") {
    return json(res, 200, capabilitiesPayload());
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", (chunk) => { buf += chunk; });
    req.on("end", () => {
      try {
        const body = buf ? JSON.parse(buf) : {};
        return handleToolCall(req, res, body);
      } catch {
        return toolError(res, 400, "BAD_REQUEST", "Invalid JSON.");
      }
    });
    return;
  }

  return toolError(res, 404, "NOT_FOUND", "Route not found");
});

server.listen(PORT, () => {
  console.log("mcp-shared-server listening on :" + PORT);
  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY).sort());
});
