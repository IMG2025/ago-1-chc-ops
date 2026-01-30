#!/usr/bin/env node
/**
 * Phase 10 — AUTHORITATIVE SERVER RESET (v4)
 * Anchor: end of import section (guaranteed invariant)
 *
 * Replaces ALL executable logic with a clean MCP server.
 * Idempotent. Ends with npm run build.
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
  console.error("Missing:", serverPath);
  process.exit(1);
}

const src = fs.readFileSync(serverPath, "utf8");

// ---- Anchor on last import line ----
const importMatches = [...src.matchAll(/^import .*;$/gm)];
if (!importMatches.length) {
  console.error("No imports found — cannot anchor safely.");
  process.exit(1);
}

const lastImport = importMatches[importMatches.length - 1];
const prefix = src.slice(0, lastImport.index + lastImport[0].length) + "\n";

// ---- Canonical server implementation ----
const replacement = `
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

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    return json(res, 200, {
      ok: true,
      tools: Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
        name,
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

fs.writeFileSync(serverPath, prefix + replacement);

console.log("Patched:", serverPath);
console.log("== Syntax check ==");
run(\`node --check \${serverPath}\`);
console.log("== Running build ==");
run("npm run build");
