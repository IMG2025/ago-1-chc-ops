#!/usr/bin/env node
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
  console.log(`mcp-shared-server listening on :${PORT}`);
  console.log("POST /tool { tool, args, ctx }");
});
