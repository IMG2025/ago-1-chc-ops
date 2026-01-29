#!/usr/bin/env node
/**
 * patch_mcp_phase8_tools_registry_metadata_v1.mjs
 * Phase 8:
 * - Upgrade GET /tools to return a versioned, self-describing registry payload.
 * - Add tool metadata: version, argsSchema, responseSchema.
 * - Expose required ctx fields + tenant namespace allowlist for clients.
 *
 * Idempotent. Ends with: npm run build
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
if (!fs.existsSync(serverPath)) {
  console.error("Missing:", serverPath);
  process.exit(1);
}

let src = read(serverPath);

// ---- Phase 8 constants + ctx schema ----
if (!src.includes('const REQUIRED_CTX_FIELDS =')) {
  // Insert near TENANT_NAMESPACE_ALLOWLIST definition
  const anchor = 'const TENANT_NAMESPACE_ALLOWLIST =';
  const idx = src.indexOf(anchor);
  if (idx < 0) {
    console.error("Anchor not found for Phase 8 insert:", anchor);
    process.exit(1);
  }
  // insert just BEFORE allowlist
  src =
    src.slice(0, idx) +
    `// Phase 8: registry/introspection schema
const MCP_TOOLS_REGISTRY_SCHEMA = "mcp.tools-registry.v1";
const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
const TOOL_META_SCHEMA_VERSION = "tool-meta.v1";

` +
    src.slice(idx);
}

// Ensure assertCtx uses REQUIRED_CTX_FIELDS (idempotent replace)
src = src.replace(
  /const required = \["tenant", "actor", "purpose", "classification", "traceId"\];/g,
  "const required = REQUIRED_CTX_FIELDS;"
);

// ---- TOOL_REGISTRY metadata upgrade ----
// We add version/argsSchema/responseSchema for shared.artifact_registry.read.
// This is a controlled replace of the tool entry block if it matches the Phase 7 shape.
if (!src.includes('"version":') && src.includes('"shared.artifact_registry.read"')) {
  src = src.replace(
    /"shared\.artifact_registry\.read":\s*\{\s*description:\s*"([^"]+)"\s*,\s*handler:\s*async\s*\(\s*\{\s*ctx\s*\}\s*\)\s*=>\s*\{/m,
    `"shared.artifact_registry.read": {
    version: "1.0.0",
    description: "$1",
    // Minimal JSON-schema-ish descriptors (tool-meta.v1)
    argsSchema: {
      type: "object",
      additionalProperties: true,
      description: "No args required (reserved for future filtering)."
    },
    responseSchema: {
      type: "object",
      required: ["schema", "tenant", "generatedAt", "artifacts"],
      properties: {
        schema: { type: "string" },
        tenant: { type: "string" },
        generatedAt: { type: "string" },
        artifacts: { type: "array" }
      }
    },
    handler: async ({ ctx }) => {`
  );
}

// ---- Upgrade GET /tools response ----
// Replace the /tools handler body to return schema + policy + tools metadata.
// We match the Phase 7 canonical /tools block and replace it.
const toolsBlockRe =
/if\s*\(req\.method\s*===\s*"GET"\s*&&\s*pathname\s*===\s*"\/tools"\)\s*\{\s*[\s\S]*?return\s+json\s*\(\s*res\s*,\s*200\s*,\s*\{\s*ok:\s*true\s*,\s*tools\s*\}\s*\)\s*;\s*\}/m;

if (!toolsBlockRe.test(src)) {
  console.error("Could not locate canonical GET /tools block to upgrade. Aborting.");
  process.exit(1);
}

src = src.replace(
  toolsBlockRe,
  `if (req.method === "GET" && pathname === "/tools") {
    const tools = Object.entries(TOOL_REGISTRY).map(([name, v]) => ({
      name,
      version: v?.version || "0.0.0",
      description: v?.description || "",
      metaSchema: TOOL_META_SCHEMA_VERSION,
      argsSchema: v?.argsSchema || { type: "object", additionalProperties: true },
      responseSchema: v?.responseSchema || { type: "object", additionalProperties: true }
    }));

    return json(res, 200, {
      ok: true,
      schema: MCP_TOOLS_REGISTRY_SCHEMA,
      requiredCtxFields: REQUIRED_CTX_FIELDS,
      tenants: Object.keys(TENANT_NAMESPACE_ALLOWLIST),
      namespaceAllowlistByTenant: TENANT_NAMESPACE_ALLOWLIST,
      tools
    });
  }`
);

writeIfChanged(serverPath, src);

console.log("== Syntax check (required gate) ==");
run(`node --check ${serverPath}`);

console.log("== Running build (required) ==");
run("npm run build");
