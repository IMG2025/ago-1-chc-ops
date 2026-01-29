#!/usr/bin/env node
/**
 * Normalize mcp-shared-server routing.
 * Guarantees:
 * - /health, /tools, /tool are siblings
 * - No nested route blocks
 * - Deterministic control flow
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

if (!fs.existsSync(serverPath)) {
  console.error("Missing server.mjs");
  process.exit(1);
}

let src = fs.readFileSync(serverPath, "utf8");

const ROUTE_BLOCK = `
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, {
      ok: true,
      service: "mcp-shared-server",
      status: "healthy"
    });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    const tools = Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
      name,
      description: v?.description || ""
    }));
    return json(res, 200, { ok: true, tools });
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", c => { buf += c; });
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

  return json(res, 404, {
    ok: false,
    error: { code: "NOT_FOUND", message: "Route not found" }
  });
});
`;

src = src.replace(
  /const server = http\.createServer\([\s\S]*?\);\s*/m,
  ROUTE_BLOCK + "\n"
);

fs.writeFileSync(serverPath, src);
console.log("Patched:", serverPath);

console.log("== Running build (required) ==");
execSync("npm run build", { stdio: "inherit" });
