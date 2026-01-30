#!/usr/bin/env node
/**
 * Phase 16 — AUTHORITATIVE MCP SHARED SERVER RESET
 *
 * Replaces the entire HTTP server wiring with a canonical implementation:
 * - GET /health
 * - GET /capabilities
 * - GET /tools
 * - POST /tool
 *
 * Preserves Phase 15 tool behavior.
 * Idempotent by replacement.
 * Ends with npm run build.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing server.mjs");
  process.exit(1);
}

const replacement = `
#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const SHARED_ARTIFACTS_PATH = path.join(ROOT, "data", "artifacts.shared.json");

const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
const TENANTS = ["shared", "chc", "ciag", "hospitality"];
const NAMESPACE_ALLOWLIST_BY_TENANT = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function assertCtx(ctx) {
  for (const k of REQUIRED_CTX_FIELDS) {
    if (!ctx?.[k]) throw new Error("Invalid ctx: missing " + k);
  }
}

function loadArtifacts() {
  return JSON.parse(fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8"));
}

const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    version: "1.0.0",
    description: "Return the shared artifact registry.",
    handler: async ({ ctx }) => {
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  },

  "shared.artifact_registry.readById": {
    version: "1.0.0",
    description: "Read artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args?.id) throw new Error("Missing args.id");
      const data = loadArtifacts();
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
    version: "1.0.0",
    description: "Search artifacts.",
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
  }
};

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/capabilities") {
    return json(res, 200, {
      ok: true,
      schema: "mcp.capabilities.v1",
      server: { name: "mcp-shared-server", version: "0.1.0" },
      protocol: { mcpVersion: "1.0.0", transport: "http-json" },
      endpoints: ["/health", "/capabilities", "/tools", "/tool"],
      requiredCtxFields: REQUIRED_CTX_FIELDS,
      tenants: TENANTS,
      namespaceAllowlistByTenant: NAMESPACE_ALLOWLIST_BY_TENANT,
      tools: Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
        name,
        version: v.version,
        description: v.description
      }))
    });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    return json(res, 200, {
      ok: true,
      schema: "mcp.tools-registry.v1",
      tools: Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
        name,
        version: v.version,
        description: v.description
      }))
    });
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", async () => {
      try {
        const { tool, args, ctx } = JSON.parse(buf || "{}");
        assertCtx(ctx);
        const entry = TOOL_REGISTRY[tool];
        if (!entry) {
          return json(res, 404, { ok: false, error: { message: "Unknown tool" } });
        }
        const data = await entry.handler({ tool, args, ctx });
        return json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } });
      } catch (e) {
        return json(res, 400, { ok: false, error: { message: e.message } });
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
`;

fs.writeFileSync(serverPath, replacement.trimStart());
console.log("Patched:", serverPath);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
