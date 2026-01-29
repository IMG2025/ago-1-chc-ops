#!/usr/bin/env node
/**
 * patch_add_mcp_thin_slice_shared_server_v1.mjs
 * Idempotent patch:
 * - Adds a minimal local "MCP-style" shared tool server (HTTP JSON)
 * - Adds shared artifact registry stub data
 * - Adds an HTTP transport adapter for Nexus MCP Gateway
 * - Keeps default-deny posture; only shared.* tools permitted by policy.ts
 * - Ends with npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }

const ROOT = sh("git rev-parse --show-toplevel");
const p = (...xs) => path.join(ROOT, ...xs);

function exists(fp) { return fs.existsSync(fp); }
function read(fp) { return fs.readFileSync(fp, "utf8"); }
function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeIfChanged(fp, next) {
  const prev = exists(fp) ? read(fp) : "";
  if (prev === next) return false;
  mkdirp(path.dirname(fp));
  fs.writeFileSync(fp, next);
  return true;
}

function ensureJsonFile(fp, obj) {
  const next = JSON.stringify(obj, null, 2) + "\n";
  return writeIfChanged(fp, next);
}

function upsertPackageScript(scriptName, scriptCmd) {
  const pkgPath = p("package.json");
  if (!exists(pkgPath)) throw new Error("package.json not found");
  const pkg = JSON.parse(read(pkgPath));
  pkg.scripts ||= {};
  if (pkg.scripts[scriptName] === scriptCmd) return false;
  pkg.scripts[scriptName] = scriptCmd;
  return writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

function main() {
  console.log("== MCP Phase 2: Thin Slice (shared.artifact_registry.read) ==");

  const changed = [];

  // 1) Stub artifact registry data (shared)
  const artifactDataPath = p("data", "artifacts.shared.json");
  const artifactData = {
    schema: "artifact-registry.v1",
    tenant: "shared",
    generatedAt: new Date().toISOString(),
    artifacts: [
      {
        id: "ECF-1",
        name: "Executive Control Framework Charter",
        version: "v1.0",
        status: "locked",
        owner: "CHC",
        pathHint: "docs/ecf/ECF-1_CHARTER.md"
      },
      {
        id: "AGO-1-CHC-OPS-RUNBOOK",
        name: "AGO-1 CHC Ops Operator Runbook",
        version: "v1.0",
        status: "locked",
        owner: "CHC",
        pathHint: "docs/CHC_OPERATOR_RUNBOOK.md"
      }
    ]
  };
  if (ensureJsonFile(artifactDataPath, artifactData)) changed.push("data/artifacts.shared.json");

  // 2) Minimal shared MCP-style server (Node http)
  const serverDir = p("services", "mcp-shared-server");
  const serverIndex = p("services", "mcp-shared-server", "server.mjs");

  const serverCode = `#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);

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

function badRequest(res, message) {
  json(res, 400, { ok: false, error: { code: "BAD_REQUEST", message } });
}

function toolNotFound(res, tool) {
  json(res, 404, { ok: false, error: { code: "TOOL_NOT_FOUND", message: "Unknown tool", details: { tool } } });
}

function handleToolCall(req, res, body) {
  const { tool, args, ctx } = body || {};
  if (!tool || typeof tool !== "string") return badRequest(res, "Missing tool (string).");
  if (!args || typeof args !== "object") return badRequest(res, "Missing args (object).");
  if (!ctx || typeof ctx !== "object") return badRequest(res, "Missing ctx (object).");

  // Only implement one tool in Phase 2
  if (tool === "shared.artifact_registry.read") {
    const tenant = ctx.tenant || "shared";
    // For thin slice, we only serve the shared registry stub.
    // Tenant scoping will expand later with Sentinel enforcement and per-tenant registries.
    if (tenant !== "shared" && tenant !== "chc" && tenant !== "ciag" && tenant !== "hospitality") {
      return badRequest(res, "Invalid ctx.tenant.");
    }

    const fp = path.join(ROOT, "data", "artifacts.shared.json");
    const data = readJson(fp);
    return json(res, 200, { ok: true, data });
  }

  return toolNotFound(res, tool);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);
  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", (chunk) => { buf += chunk; });
    req.on("end", () => {
      try {
        const body = buf ? JSON.parse(buf) : {};
        return handleToolCall(req, res, body);
      } catch {
        return badRequest(res, "Invalid JSON.");
      }
    });
    return;
  }

  json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
});

server.listen(PORT, () => {
  console.log(\`mcp-shared-server listening on :\${PORT}\`);
  console.log("POST /tool { tool, args, ctx }");
});
`;

  if (writeIfChanged(serverIndex, serverCode)) changed.push("services/mcp-shared-server/server.mjs");
  // Ensure executable bit on unix files is not guaranteed via FS write; user can chmod if needed.

  // 3) Add npm script to run the server (non-breaking)
  const scriptChanged = upsertPackageScript("mcp:shared", "node services/mcp-shared-server/server.mjs");
  if (scriptChanged) changed.push("package.json (scripts.mcp:shared)");

  // 4) HTTP transport adapter for Nexus MCP Gateway
  const transportDir = p("src", "mcp", "transports");
  const httpTransportPath = p("src", "mcp", "transports", "httpTransport.ts");
  const transportIndexPath = p("src", "mcp", "transports", "index.ts");

  const httpTransport = `import type { ToolRequest, ToolResponse } from "../envelopes";

export type HttpTransportConfig = {
  baseUrl: string; // e.g. http://127.0.0.1:8787
  timeoutMs?: number;
};

export function createHttpToolTransport(cfg: HttpTransportConfig) {
  const timeoutMs = cfg.timeoutMs ?? 10_000;

  return async function httpTransport(req: ToolRequest): Promise<ToolResponse> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(\`\${cfg.baseUrl}/tool\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal
      });

      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        return {
          ok: false,
          error: { code: "BAD_RESPONSE", message: "Non-JSON response from tool server." },
          meta: { traceId: req.ctx.traceId, durationMs: 0 }
        };
      }

      // Pass through server response; gateway normalizes meta
      return json as ToolResponse;
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Tool call timed out." : "Tool call failed.";
      return {
        ok: false,
        error: { code: "TRANSPORT_ERROR", message: msg, details: String(e?.message ?? e) },
        meta: { traceId: req.ctx.traceId, durationMs: 0 }
      };
    } finally {
      clearTimeout(t);
    }
  };
}
`;
  const transportIndex = `export * from "./httpTransport";
`;

  if (writeIfChanged(httpTransportPath, httpTransport)) changed.push("src/mcp/transports/httpTransport.ts");
  if (writeIfChanged(transportIndexPath, transportIndex)) changed.push("src/mcp/transports/index.ts");

  // 5) Export transports from src/mcp/index.ts
  const mcpIndexPath = p("src", "mcp", "index.ts");
  if (!exists(mcpIndexPath)) throw new Error("src/mcp/index.ts missing; Phase 1 must be applied first.");
  const mcpIndexPrev = read(mcpIndexPath);
  if (!mcpIndexPrev.includes(`export * from "./transports";`)) {
    const next = mcpIndexPrev.replace(/\s*$/, "") + `\nexport * from "./transports";\n`;
    if (writeIfChanged(mcpIndexPath, next)) changed.push("src/mcp/index.ts (export transports)");
  }

  console.log("Changed files:", changed.length ? changed : "(no changes; already applied)");

  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
