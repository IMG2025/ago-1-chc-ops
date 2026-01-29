#!/usr/bin/env node
/**
 * patch_mcp_server_tools_list_and_policy_v1.mjs
 * Phase 7A+7B:
 * - Add GET /tools to mcp-shared-server (discoverability)
 * - Harden policy checks for required ctx fields + namespace allowlist
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  if (prev !== next) {
    fs.writeFileSync(p, next);
    console.log("Patched:", p);
    return true;
  }
  return false;
}
function mustExist(p) {
  if (!fs.existsSync(p)) {
    console.error("Missing file:", p);
    process.exit(1);
  }
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");
const sharedArtifactsPath = path.join(ROOT, "data", "artifacts.shared.json");

mustExist(serverPath);
mustExist(sharedArtifactsPath);

let changed = false;

const serverSrc = read(serverPath);

// FIXED: missing ')' in the original
const hasToolsEndpoint =
  serverSrc.includes("GET /tools") ||
  serverSrc.includes('app.get("/tools"') ||
  serverSrc.includes("app.get('/tools'");

const hasRegistry = serverSrc.includes("TOOL_REGISTRY") || serverSrc.includes("toolRegistry");

const anchor =
  serverSrc.includes("const app =") ? "const app =" :
  (serverSrc.includes("app.post(") ? "app.post(" : null);

if (!anchor) {
  console.error("Could not find patch anchor in server.mjs (no const app = / app.post).");
  process.exit(1);
}

let nextServer = serverSrc;

if (!hasRegistry) {
  const nl = "\n";
  const registryBlock =
`${nl}// == MCP tool registry (Phase 7) ==
// NOTE: Keep this server minimal; domain tool servers can live elsewhere later.
const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    description: "Return the shared artifact registry (read-only bootstrap tool).",
    handler: async ({ tool, args, ctx }) => {
      const raw = await fs.promises.readFile(SHARED_ARTIFACTS_PATH, "utf8");
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

// Default allowlist by tenant (tighten over time; default-deny elsewhere)
const TENANT_NAMESPACE_ALLOWLIST = {
  shared: ["shared."]
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
  return allowed.some(prefix => tool.startsWith(prefix));
}
`;

  if (!nextServer.includes("import fs from") && !nextServer.includes('from "node:fs"')) {
    nextServer = `import fs from "node:fs";\n` + nextServer;
    changed = true;
  }

  if (!nextServer.includes("SHARED_ARTIFACTS_PATH")) {
    const topInsert = `const SHARED_ARTIFACTS_PATH = ${JSON.stringify(sharedArtifactsPath)};\n`;
    nextServer = topInsert + nextServer;
    changed = true;
  }

  const idx = nextServer.indexOf("const SHARED_ARTIFACTS_PATH");
  if (idx >= 0) {
    const endLine = nextServer.indexOf("\n", idx);
    nextServer = nextServer.slice(0, endLine + 1) + registryBlock + nextServer.slice(endLine + 1);
    changed = true;
  } else {
    nextServer = registryBlock + nextServer;
    changed = true;
  }
}

if (!hasToolsEndpoint) {
  const postIdx = nextServer.indexOf("app.post");
  if (postIdx < 0) {
    console.error("Could not find app.post route to insert /tools before.");
    process.exit(1);
  }

  const toolsRoute =
`\n// GET /tools — discoverability for clients\napp.get("/tools", (_req, res) => {\n  const tools = Object.entries(TOOL_REGISTRY).map(([name, v]) => ({ name, description: v.description || "" }));\n  res.json({ ok: true, tools });\n});\n\n`;

  nextServer = nextServer.slice(0, postIdx) + toolsRoute + nextServer.slice(postIdx);
  changed = true;
}

// Harden /tool
if (!nextServer.includes("assertCtx(") || !nextServer.includes("isToolAllowed(") || !nextServer.includes("TOOL_REGISTRY")) {
  const routeIdx = nextServer.indexOf('app.post("/tool"');
  if (routeIdx < 0) {
    console.error('Could not find app.post("/tool" route to harden.');
    process.exit(1);
  }

  const bodyPattern = "{ tool, args, ctx }";
  const bodyIdx = nextServer.indexOf(bodyPattern, routeIdx);

  if (bodyIdx >= 0) {
    const insertPoint = nextServer.indexOf("\n", bodyIdx);
    const guard =
`\n    // Phase 7 policy enforcement\n    assertCtx(ctx);\n    if (!isToolAllowed(tool, ctx)) {\n      return res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: "Tool not allowed for tenant" }, meta: { traceId: ctx.traceId } });\n    }\n    const entry = TOOL_REGISTRY[tool];\n    if (!entry) {\n      return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Unknown tool" }, meta: { traceId: ctx.traceId } });\n    }\n`;
    if (!nextServer.includes(guard.trim())) {
      nextServer = nextServer.slice(0, insertPoint + 1) + guard + nextServer.slice(insertPoint + 1);
      changed = true;
    }
  }

  if (!nextServer.includes("entry.handler")) {
    const handlerCall = `const data = await entry.handler({ tool, args, ctx });`;
    if (!nextServer.includes(handlerCall)) {
      const resJsonIdx = nextServer.indexOf("res.json", routeIdx);
      if (resJsonIdx > 0) {
        const lineStart = nextServer.lastIndexOf("\n", resJsonIdx);
        nextServer = nextServer.slice(0, lineStart + 1) + `    ${handlerCall}\n` + nextServer.slice(lineStart + 1);
        changed = true;
      }
    }
  }
}

writeIfChanged(serverPath, nextServer);

console.log("== Running build (required) ==");
run("npm run build");
