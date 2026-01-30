#!/usr/bin/env node
/**
 * Phase 17A — Authoritative MCP shared server contract hardening
 *
 * Guarantees:
 * - Single canonical capabilities generator
 * - /tools is derived from /capabilities.tools (no drift)
 * - /tool enforces:
 *    - required ctx fields (400)
 *    - tenant allowlist (400)
 *    - namespace allowlist (403)
 *    - unknown tool (404)
 *
 * Idempotent via full-file replacement.
 * Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

const replacement = `#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const SHARED_ARTIFACTS_PATH = path.join(ROOT, "data", "artifacts.shared.json");

/** ===== Contract constants (Phase 17) ===== */
const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
const TENANTS = ["shared", "chc", "ciag", "hospitality"];
const NAMESPACE_ALLOWLIST_BY_TENANT = Object.freeze({
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
});

/** ===== Helpers ===== */
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function err(res, status, code, message, meta = undefined) {
  return json(res, status, { ok: false, error: { code, message, ...(meta ? { details: meta } : {}) } });
}

function assertCtx(ctx) {
  if (!ctx || typeof ctx !== "object") {
    const e = new Error("Invalid ctx: missing ctx");
    e.httpStatus = 400;
    throw e;
  }
  for (const k of REQUIRED_CTX_FIELDS) {
    if (typeof ctx[k] !== "string" || !ctx[k].trim()) {
      const e = new Error("Invalid ctx: missing " + k);
      e.httpStatus = 400;
      throw e;
    }
  }
  if (!TENANTS.includes(ctx.tenant)) {
    const e = new Error("Invalid ctx: tenant not allowed");
    e.httpStatus = 400;
    throw e;
  }
}

function isToolAllowed(tool, tenant) {
  const allow = NAMESPACE_ALLOWLIST_BY_TENANT[tenant] || [];
  return allow.some(prefix => tool.startsWith(prefix));
}

function loadArtifacts() {
  const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
  return JSON.parse(raw);
}

/** ===== Tool registry (Phase 17) ===== */
const TOOL_REGISTRY = Object.freeze({
  "shared.artifact_registry.read": Object.freeze({
    version: "1.0.0",
    description: "Return the shared artifact registry.",
    argsSchema: { type: "object", additionalProperties: true, description: "No args required." },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ ctx }) => {
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  }),

  "shared.artifact_registry.readById": Object.freeze({
    version: "1.0.0",
    description: "Read artifact by id.",
    argsSchema: { type: "object", additionalProperties: true, required: ["id"], properties: { id: { type: "string" } } },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ args, ctx }) => {
      if (!args?.id) {
        const e = new Error("Missing args.id");
        e.httpStatus = 400;
        throw e;
      }
      const data = loadArtifacts();
      const artifact = (data.artifacts || []).find(a => a.id === args.id) || null;
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        id: args.id,
        artifact
      };
    }
  }),

  "shared.artifact_registry.search": Object.freeze({
    version: "1.0.0",
    description: "Search artifacts.",
    argsSchema: { type: "object", additionalProperties: true, properties: { q: { type: "string" } } },
    responseSchema: { type: "object", additionalProperties: true },
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = loadArtifacts();
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
  })
});

function listTools() {
  return Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
    name,
    version: v.version,
    description: v.description,
    metaSchema: "tool-meta.v1",
    argsSchema: v.argsSchema || { type: "object", additionalProperties: true },
    responseSchema: v.responseSchema || { type: "object", additionalProperties: true }
  }));
}

function capabilities() {
  return {
    ok: true,
    schema: "mcp.capabilities.v1",
    server: { name: "mcp-shared-server", version: "0.1.0" },
    protocol: { mcpVersion: "1.0.0", transport: "http-json" },
    endpoints: ["/health", "/capabilities", "/tools", "/tool"],
    requiredCtxFields: REQUIRED_CTX_FIELDS,
    tenants: TENANTS,
    namespaceAllowlistByTenant: NAMESPACE_ALLOWLIST_BY_TENANT,
    tools: listTools()
  };
}

/** ===== HTTP server ===== */
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/capabilities") {
    return json(res, 200, capabilities());
  }

  // /tools MUST be derived from capabilities.tools (no drift)
  if (req.method === "GET" && parsed.pathname === "/tools") {
    const caps = capabilities();
    return json(res, 200, { ok: true, schema: "mcp.tools-registry.v1", tools: caps.tools });
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", async () => {
      try {
        const body = buf ? JSON.parse(buf) : {};
        const tool = body?.tool;
        const args = body?.args || {};
        const ctx = body?.ctx;

        if (!tool || typeof tool !== "string") return err(res, 400, "BAD_REQUEST", "Missing tool (string).");
        if (!args || typeof args !== "object") return err(res, 400, "BAD_REQUEST", "Missing args (object).");

        assertCtx(ctx);

        // Namespace allowlist
        if (!isToolAllowed(tool, ctx.tenant)) {
          return json(res, 403, { ok: false, error: { code: "FORBIDDEN", message: "Tool not allowed for tenant.", details: { tool, tenant: ctx.tenant } }, meta: { traceId: ctx.traceId } });
        }

        const entry = TOOL_REGISTRY[tool];
        if (!entry) {
          return json(res, 404, { ok: false, error: { code: "TOOL_NOT_FOUND", message: "Unknown tool", details: { tool } }, meta: { traceId: ctx.traceId } });
        }

        const data = await entry.handler({ tool, args, ctx });
        return json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } });
      } catch (e) {
        const status = e?.httpStatus || 400;
        return json(res, status, { ok: false, error: { code: "BAD_REQUEST", message: e?.message || "Invalid request" } });
      }
    });
    return;
  }

  return err(res, 404, "NOT_FOUND", "Route not found");
});

server.listen(PORT, () => {
  console.log("mcp-shared-server listening on :" + PORT);
  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY));
});
`;

fs.writeFileSync(serverPath, replacement);
console.log("Patched:", serverPath);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
