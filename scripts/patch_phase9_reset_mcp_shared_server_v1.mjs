#!/usr/bin/env node
/**
 * Phase 9R — Canonical MCP Shared Server Reset
 * Replaces server.mjs with a clean, deterministic implementation.
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

const CANONICAL = `#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.MCP_SHARED_PORT || 8787);
const REPO_ROOT = process.env.REPO_ROOT || process.cwd();
const SHARED_ARTIFACTS_PATH = path.join(REPO_ROOT, "data", "artifacts.shared.json");

const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    description: "Return the shared artifact registry",
    handler: async ({ ctx }) => {
      const raw = fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8");
      const data = JSON.parse(raw);
      return {
        schema: "artifact-registry.v1",
        tenant: ctx.tenant,
        generatedAt: new Date().toISOString(),
        artifacts: data.artifacts || []
      };
    }
  }
};

const REQUIRED_CTX = ["tenant","actor","purpose","classification","traceId"];
const ALLOWLIST = {
  shared: ["shared."]
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

function assertCtx(ctx) {
  for (const k of REQUIRED_CTX) {
    if (!ctx || typeof ctx[k] !== "string" || !ctx[k]) {
      throw new Error("Invalid ctx: missing " + k);
    }
  }
}

function isAllowed(tool, ctx) {
  return (ALLOWLIST[ctx.tenant] || []).some(p => tool.startsWith(p));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server" });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    return json(res, 200, {
      ok: true,
      tools: Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
        name,
        description: v.description || ""
      }))
    });
  }

  if (req.method === "GET" && parsed.pathname === "/debug") {
    return json(res, 200, {
      ok: true,
      registryKeys: Object.keys(TOOL_REGISTRY)
    });
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", c => buf += c);
    req.on("end", async () => {
      try {
        const { tool, args, ctx } = JSON.parse(buf || "{}");
        assertCtx(ctx);
        if (!isAllowed(tool, ctx)) {
          return json(res, 403, { ok:false, error:"FORBIDDEN" });
        }
        const entry = TOOL_REGISTRY[tool];
        if (!entry) {
          return json(res, 404, { ok:false, error:"NOT_FOUND" });
        }
        const data = await entry.handler({ tool, args, ctx });
        return json(res, 200, { ok:true, data });
      } catch (e) {
        return json(res, 400, { ok:false, error:e.message });
      }
    });
    return;
  }

  json(res, 404, { ok:false, error:"NOT_FOUND" });
});

server.listen(PORT, () => {
  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY));
  console.log("mcp-shared-server listening on :" + PORT);
});
`;

fs.writeFileSync(serverPath, CANONICAL);
console.log("Replaced:", serverPath);

run("node --check " + serverPath);
run("npm run build");
