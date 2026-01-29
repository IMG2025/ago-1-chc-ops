#!/usr/bin/env node
/**
 * patch_add_mcp_contract_v1.mjs
 * Idempotent patch:
 * - Adds MCP contract docs
 * - Adds src/mcp scaffolding (envelopes + gateway interface + policy hook)
 * - Wires exports (non-breaking)
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

function ensureLineInFile(fp, line) {
  const prev = exists(fp) ? read(fp) : "";
  if (prev.split(/\r?\n/).includes(line)) return false;
  const next = prev.length ? (prev.replace(/\s*$/, "") + "\n" + line + "\n") : (line + "\n");
  return writeIfChanged(fp, next);
}

function main() {
  console.log("== MCP Phase 1: Contract + Scaffolding ==");

  // 1) Docs
  const contract = `# MCP Tool Contract (CoreIdentity / CHC Ecosystem)

## Purpose
Model Context Protocol (MCP) is the **standard tool interface plane** between:
- **Agents** (AGO-1 variants)
- **Orchestration** (Nexus OS)
- **Governance** (Sentinel OS)
- **Tool Providers** (MCP Servers)

This prevents bespoke integrations per agent and enables enforceable governance.

## Non-Negotiable Rule
**Agents do not integrate directly with external systems.**
All tool access flows: **AGO-1 → Nexus MCP Gateway → MCP Server**, governed by Sentinel.

## Tool Call Envelope (Canonical)
### ToolRequest
- \`tool\`: string (namespaced, e.g., \`shared.artifact_registry.read\`)
- \`args\`: object (JSON-serializable)
- \`ctx\`: object
  - \`tenant\`: "chc" | "ciag" | "hospitality" | "shared"
  - \`actor\`: string (who/what initiated)
  - \`purpose\`: string (why)
  - \`classification\`: "public" | "internal" | "confidential" | "restricted"
  - \`traceId\`: string (correlation)

### ToolResponse
- \`ok\`: boolean
- \`data\`: any (present when ok)
- \`error\`: { code, message, details? } (present when !ok)
- \`meta\`: { traceId, durationMs }

## Governance (Sentinel) Requirements
- Default-deny allowlist
- Audit log for every call (traceId, tool, tenant, actor, purpose)
- Input/output redaction policy by classification
- Rate/spend controls where applicable

## Namespaces
- \`chc.*\` CHC Ops tools
- \`ciag.*\` CIAG tools
- \`hospitality.*\` Hospitality tools
- \`shared.*\` Cross-domain utilities

`;
  const namespaces = `# MCP Tool Namespaces

## shared.*
- \`shared.artifact_registry.read\`
  - Read-only view of locked artifacts + runbooks metadata for the active tenant.

## chc.*
(Reserved) Governance registry, portfolio snapshots, compliance reporting.

## ciag.*
(Reserved) Lead/CRM ops, proposal assembly, engagement runbooks.

## hospitality.*
(Reserved) Data ingest, tariff tracking inputs, simulation datasets.

`;

  const changed = [];
  if (writeIfChanged(p("docs", "MCP_TOOL_CONTRACT.md"), contract)) changed.push("docs/MCP_TOOL_CONTRACT.md");
  if (writeIfChanged(p("docs", "MCP_TOOL_NAMESPACES.md"), namespaces)) changed.push("docs/MCP_TOOL_NAMESPACES.md");

  // 2) src/mcp scaffolding
  const envelopesTs = `export type Tenant = "chc" | "ciag" | "hospitality" | "shared";
export type Classification = "public" | "internal" | "confidential" | "restricted";

export type ToolRequest = {
  tool: string;
  args: Record<string, unknown>;
  ctx: {
    tenant: Tenant;
    actor: string;
    purpose: string;
    classification: Classification;
    traceId: string;
  };
};

export type ToolError = {
  code: string;
  message: string;
  details?: unknown;
};

export type ToolResponse<T = unknown> = {
  ok: true;
  data: T;
  meta: { traceId: string; durationMs: number };
} | {
  ok: false;
  error: ToolError;
  meta: { traceId: string; durationMs: number };
};
`;

  const policyTs = `import type { ToolRequest } from "./envelopes";

/**
 * Sentinel-facing policy hook.
 * Phase 1: allow only shared.* tools.
 * Anything else is default-deny.
 */
export function evaluateToolPolicy(req: ToolRequest): { allowed: boolean; reason?: string } {
  if (req.tool.startsWith("shared.")) return { allowed: true };
  return { allowed: false, reason: "Tool not allowlisted (default-deny)." };
}
`;

  const gatewayTs = `import type { ToolRequest, ToolResponse } from "./envelopes";
import { evaluateToolPolicy } from "./policy";

export type ToolTransport = (req: ToolRequest) => Promise<ToolResponse>;

/**
 * Nexus MCP Gateway (Phase 1 interface)
 * - Applies policy gate
 * - Delegates to a transport (HTTP/MCP SDK later)
 */
export async function callTool(transport: ToolTransport, req: ToolRequest): Promise<ToolResponse> {
  const t0 = Date.now();
  const policy = evaluateToolPolicy(req);
  if (!policy.allowed) {
    return {
      ok: false,
      error: { code: "POLICY_DENY", message: policy.reason ?? "Denied." },
      meta: { traceId: req.ctx.traceId, durationMs: Date.now() - t0 }
    };
  }

  const res = await transport(req);
  const durationMs = Date.now() - t0;

  // Normalize meta
  if ((res as any)?.meta?.traceId) {
    return { ...res, meta: { ...(res as any).meta, traceId: req.ctx.traceId, durationMs } } as ToolResponse;
  }
  return res;
}
`;

  const indexTs = `export * from "./envelopes";
export * from "./gateway";
export * from "./policy";
`;

  if (writeIfChanged(p("src", "mcp", "envelopes.ts"), envelopesTs)) changed.push("src/mcp/envelopes.ts");
  if (writeIfChanged(p("src", "mcp", "policy.ts"), policyTs)) changed.push("src/mcp/policy.ts");
  if (writeIfChanged(p("src", "mcp", "gateway.ts"), gatewayTs)) changed.push("src/mcp/gateway.ts");
  if (writeIfChanged(p("src", "mcp", "index.ts"), indexTs)) changed.push("src/mcp/index.ts");

  // 3) Export wiring (non-breaking)
  const rootIndex = p("src", "index.ts");
  if (exists(rootIndex)) {
    ensureLineInFile(rootIndex, `export * as mcp from "./mcp";`);
  }

  console.log("Changed files:", changed.length ? changed : "(no changes; already applied)");
  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
