#!/usr/bin/env node
/**
 * Phase 18 — AUTHORITATIVE SERVER RESET (v2)
 * Purpose:
 * - Replace mcp-shared-server entirely
 * - Add per-tenant registry tools (chc / ciag / hospitality)
 * - Preserve Phase 17 contract hardening
 *
 * Idempotent by replacement.
 * Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import url from "node:url";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

const CONTENT = `#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const ARTIFACTS_PATH = path.join(ROOT, "data", "artifacts.shared.json");

/* ---------------- helpers ---------------- */

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function loadArtifacts() {
  return JSON.parse(fs.readFileSync(ARTIFACTS_PATH, "utf8"));
}

const REQUIRED_CTX_FIELDS = [
  "tenant",
  "actor",
  "purpose",
  "classification",
  "traceId"
];

function assertCtx(ctx) {
  for (const k of REQUIRED_CTX_FIELDS) {
    if (!ctx?.[k]) {
      const e = new Error("Invalid ctx: missing " + k);
      e.httpStatus = 400;
      throw e;
    }
  }
}

/* ---------------- policy ---------------- */

const NAMESPACE_ALLOWLIST_BY_TENANT = Object.freeze({
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
});

function isAllowed(tool, tenant) {
  const allowed = NAMESPACE_ALLOWLIST_BY_TENANT[tenant] || [];
  return allowed.some(p => tool.startsWith(p));
}

/* ---------------- tools ---------------- */

const TOOL_REGISTRY = Object.freeze({
  /* shared */
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
      if (!args?.id) {
        const e = new Error("Missing args.id");
        e.httpStatus = 400;
        throw e;
      }
      const data = loadArtifacts();
      return {
        schema: "artifact-registry.readById.v1",
        tenant: ctx.tenant,
        artifact: (data.artifacts || []).find(a => a.id === args.id) || null
      };
    }
  },

  "shared.artifact_registry.search": {
    version: "1.0.0",
    description: "Search artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const data = loadArtifacts();
      const hits = q
        ? (data.artifacts || []).filter(a =>
            JSON.stringify(a).toLowerCase().includes(q)
          )
        : (data.artifacts || []);
      return {
        schema: "artifact-registry.search.v1",
        tenant: ctx.tenant,
        count: hits.length,
        artifacts: hits
      };
    }
  },

  /* tenant stubs */
  "chc.artifact_registry.read": {
    version: "1.0.0",
    description: "CHC tenant artifact registry (stub).",
    handler: async () => ({
      schema: "artifact-registry.v1",
      tenant: "chc",
      generatedAt: new Date().toISOString(),
      artifacts: loadArtifacts().artifacts || []
    })
  },

  "ciag.artifact_registry.read": {
    version: "1.0.0",
    description: "CIAG tenant artifact registry (stub).",
    handler: async () => ({
      schema: "artifact-registry.v1",
      tenant: "ciag",
      generatedAt: new Date().toISOString(),
      artifacts: loadArtifacts().artifacts || []
    })
  },

  "hospitality.artifact_registry.read": {
    version: "1.0.0",
    description: "Hospitality tenant artifact registry (stub).",
    handler: async () => ({
      schema: "artifact-registry.v1",
      tenant: "hospitality",
      generatedAt: new Date().toISOString(),
      artifacts: loadArtifacts().artifacts || []
    })
  }
});

/* ---------------- derived contracts ---------------- */

function listTools() {
  return Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
    name,
    version: v.version,
    description: v.description
  }));
}

/* ---------------- server ---------------- */

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    return json(res, 200, { ok: true, tools: listTools() });
  }

  if (req.method === "GET" && parsed.pathname === "/capabilities") {
    return json(res, 200, {
      ok: true,
      schema: "mcp.capabilities.v1",
      requiredCtxFields: REQUIRED_CTX_FIELDS,
      tenants: Object.keys(NAMESPACE_ALLOWLIST_BY_TENANT),
      namespaceAllowlistByTenant: NAMESPACE_ALLOWLIST_BY_TENANT,
      tools: listTools()
    });
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", c => (buf += c));
    req.on("end", async () => {
      try {
        const { tool, args, ctx } = JSON.parse(buf || "{}");
        assertCtx(ctx);

        if (!isAllowed(tool, ctx.tenant)) {
          return json(res, 403, { ok: false, error: { message: "Forbidden" } });
        }

        const entry = TOOL_REGISTRY[tool];
        if (!entry) {
          return json(res, 404, { ok: false, error: { message: "Unknown tool" } });
        }

        const data = await entry.handler({ tool, args, ctx });
        return json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } });
      } catch (e) {
        return json(res, e.httpStatus || 400, { ok: false, error: { message: e.message } });
      }
    });
    return;
  }

  return json(res, 404, { ok: false, error: { message: "Route not found" } });
});

server.listen(PORT, () => {
  console.log("mcp-shared-server listening on :" + PORT);
  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY));
});
`;

fs.writeFileSync(serverPath, CONTENT);
console.log("Patched:", serverPath);

console.log("== Syntax check (required gate) ==");
run("node --check " + serverPath);

console.log("== Running build (required) ==");
run("npm run build");
