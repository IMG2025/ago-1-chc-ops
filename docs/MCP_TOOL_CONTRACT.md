# MCP Tool Contract (CoreIdentity / CHC Ecosystem)

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
- `tool`: string (namespaced, e.g., `shared.artifact_registry.read`)
- `args`: object (JSON-serializable)
- `ctx`: object
  - `tenant`: "chc" | "ciag" | "hospitality" | "shared"
  - `actor`: string (who/what initiated)
  - `purpose`: string (why)
  - `classification`: "public" | "internal" | "confidential" | "restricted"
  - `traceId`: string (correlation)

### ToolResponse
- `ok`: boolean
- `data`: any (present when ok)
- `error`: { code, message, details? } (present when !ok)
- `meta`: { traceId, durationMs }

## Governance (Sentinel) Requirements
- Default-deny allowlist
- Audit log for every call (traceId, tool, tenant, actor, purpose)
- Input/output redaction policy by classification
- Rate/spend controls where applicable

## Namespaces
- `chc.*` CHC Ops tools
- `ciag.*` CIAG tools
- `hospitality.*` Hospitality tools
- `shared.*` Cross-domain utilities

