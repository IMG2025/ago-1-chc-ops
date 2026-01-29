#!/usr/bin/env node
/**
 * patch_normalize_mcp_shared_server_wiring_v2.mjs
 * Hard-normalize the server wiring to eliminate brace drift:
 * - Rewrites the entire `const server = http.createServer...` through `server.listen(...)` block.
 * - Guarantees /health, /tools, /tool are siblings inside the request handler.
 * - Ensures there is no top-level `return` / route logic outside the handler.
 *
 * Idempotent. Ends with: npm run build
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

const prev = fs.readFileSync(serverPath, "utf8");

// We replace from `const server = http.createServer` through the closing `server.listen(...);`
// This is the only safe way to guarantee no top-level route logic remains.
const WIRING_RE = /const\s+server\s*=\s*http\.createServer\([\s\S]*?\nserver\.listen\([\s\S]*?\);\s*/m;

const wiringBlock = `
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
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

  return json(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
});

server.listen(PORT, () => {
  console.log(\`mcp-shared-server listening on :\${PORT}\`);
  console.log("GET  /health");
  console.log("GET  /tools");
  console.log("POST /tool { tool, args, ctx }");
});
`;

let next = prev;

if (WIRING_RE.test(prev)) {
  next = prev.replace(WIRING_RE, wiringBlock + "\n");
} else {
  // If wiring block missing/corrupted, append a fresh wiring block at end (still deterministic)
  next = prev.trimEnd() + "\n\n" + wiringBlock + "\n";
}

// Extra safety: if any top-level "return json(res" exists outside the handler, Node will fail.
// We can’t perfectly parse JS here, but we CAN fail fast by running node --check.
fs.writeFileSync(serverPath, next);
console.log("Patched:", serverPath);

console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required) ==");
run("npm run build");
