#!/usr/bin/env node
/**
 * patch_rebuild_mcp_shared_server_phase7_v3.mjs
 * Canonical rebuild of services/mcp-shared-server/server.mjs to eliminate brace drift.
 *
 * Phase 7A+7B:
 * - GET /health
 * - GET /tools (discoverability)
 * - POST /tool (ctx-required + namespace allowlist + registry dispatch)
 *
 * Idempotent (writes only if different). Ends with: npm run build
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
const sharedArtifactsPath = path.join(ROOT, "data", "artifacts.shared.json");

if (!fs.existsSync(sharedArtifactsPath)) {
  console.error("Missing required shared artifacts file:", sharedArtifactsPath);
  process.exit(1);
}

const next = `#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const SHARED_ARTIFACTS_PATH = ${JSON.stringify(sharedArtifactsPath)};

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
    description: "Return the shared artifact registry (read-only bootstrap tool).",
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
const TENANT_NAMESPACE_ALLOWLIST = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
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
      description: v?.description || ""
    }));
    return json(res, 200, { ok: true, tools });
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
  console.log(\`mcp-shared-server listening on :\${PORT}\`);
  console.log("GET  /health");
  console.log("GET  /tools");
  console.log("POST /tool { tool, args, ctx }");
});
`;

writeIfChanged(serverPath, next);

console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required) ==");
run("npm run build");
