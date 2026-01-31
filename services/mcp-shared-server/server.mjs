#!/usr/bin/env node
import http from "node:http";
import url from "node:url";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.REPO_ROOT || process.cwd();
const PORT = Number(process.env.MCP_SHARED_PORT || 8787);

const TENANTS = ["shared", "chc", "ciag", "hospitality"];
const REQUIRED_CTX_FIELDS = ["tenant", "actor", "purpose", "classification", "traceId"];
// == Contract evolution ==
const CONTRACT_VERSION = "21C.1.0";
const MIN_SUPPORTED_CONTRACT_VERSION = "21A.1.0";
// == Contract evolution ==

const TENANT_NAMESPACE_ALLOWLIST = {
  shared: ["shared."],
  chc: ["shared.", "chc."],
  ciag: ["shared.", "ciag."],
  hospitality: ["shared.", "hospitality."]
};

const TENANT_REGISTRY_PATHS = {
  shared: path.join(ROOT, "data", "artifacts.shared.json"),
  chc: path.join(ROOT, "data", "artifacts.chc.json"),
  ciag: path.join(ROOT, "data", "artifacts.ciag.json"),
  hospitality: path.join(ROOT, "data", "artifacts.hospitality.json")
};

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function toolError(res, status, code, message, traceId, details) {
  return json(res, status, {
    ok: false,
    error: { code, message, ...(details ? { details } : {}) },
    ...(traceId ? { meta: { traceId } } : {})
  });
}

function assertCtx(ctx) {
  for (const k of REQUIRED_CTX_FIELDS) {
    if (!ctx || typeof ctx[k] !== "string" || !ctx[k].trim()) {
      const msg = "Invalid ctx: missing " + k;
      const err = new Error(msg);
      // used only for message; callers return 400
      throw err;
    }
  }
  if (!TENANTS.includes(ctx.tenant)) {
    throw new Error("Invalid ctx: unknown tenant");
  }
}

function parseContractVersion(v) {
  // Expected: "21A.1.0" -> { phase: 21, suffix: "A", patch: 1, minor: 0 }
  // Also tolerates "21.1.0" -> suffix "".
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^([0-9]+)([A-Za-z]?)[.]([0-9]+)[.]([0-9]+)$/);
  if (!m) return null;
  const phase = Number(m[1]);
  const suffix = (m[2] || "").toUpperCase();
  const patch = Number(m[3]);
  const minor = Number(m[4]);
  if (!Number.isFinite(phase) || !Number.isFinite(patch) || !Number.isFinite(minor)) return null;
  const suffixRank = suffix ? (suffix.charCodeAt(0) - 64) : 0; // A=1, B=2...
  return { phase, suffix, suffixRank, patch, minor, raw: v.trim() };
}

function cmpContractVersion(a, b) {
  const A = parseContractVersion(a);
  const B = parseContractVersion(b);
  if (!A || !B) return null;
  if (A.phase !== B.phase) return A.phase < B.phase ? -1 : 1;
  if (A.suffixRank !== B.suffixRank) return A.suffixRank < B.suffixRank ? -1 : 1;
  if (A.patch !== B.patch) return A.patch < B.patch ? -1 : 1;
  if (A.minor !== B.minor) return A.minor < B.minor ? -1 : 1;
  return 0;
}

function assertContractWindow(ctxVersion) {
  // Enforce: MIN_SUPPORTED <= ctx.contractVersion <= CONTRACT_VERSION
  const lo = cmpContractVersion(ctxVersion, MIN_SUPPORTED_CONTRACT_VERSION);
  const hi = cmpContractVersion(ctxVersion, CONTRACT_VERSION);
  if (lo === null || hi === null) throw new Error("Invalid ctx.contractVersion format");
  if (lo < 0) return { ok: false, code: "CONTRACT_TOO_OLD", status: 409, details: { minSupported: MIN_SUPPORTED_CONTRACT_VERSION, got: ctxVersion } };
  if (hi > 0) return { ok: false, code: "CONTRACT_TOO_NEW", status: 409, details: { current: CONTRACT_VERSION, got: ctxVersion } };
  return { ok: true };
}

function assertToolMinContract(ctxVersion, minVersion) {
  if (!minVersion) return { ok: true };
  const c = cmpContractVersion(ctxVersion, minVersion);
  if (c === null) throw new Error("Invalid contract version compare");
  if (c < 0) return { ok: false, code: "CONTRACT_UNSUPPORTED_FOR_TOOL", status: 409, details: { toolMin: minVersion, got: ctxVersion } };
  return { ok: true };
}

function isToolAllowed(tool, tenant) {
  const allowed = TENANT_NAMESPACE_ALLOWLIST[tenant] || [];
  return allowed.some((prefix) => tool.startsWith(prefix));
}

function readRegistryFile(tenant) {
  const fp = TENANT_REGISTRY_PATHS[tenant];
  if (!fp) throw new Error("Unknown tenant: " + tenant);
  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  const artifacts = Array.isArray(raw.artifacts) ? raw.artifacts : [];
  return {
    schema: raw.schema || "artifact-registry.v1",
    tenant: raw.tenant || tenant,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    artifacts
  };
}

// == Tool registry (authoritative) ==
const TOOL_REGISTRY = {
  "shared.artifact_registry.read": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Return the shared artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("shared")
  },

  "shared.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read shared artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("shared");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },

  "shared.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21C.1.0",
    description: "Search shared artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("shared");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },

  "chc.artifact_registry.read": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Return the CHC tenant artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("chc")
  },

  "ciag.artifact_registry.read": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Return the CIAG tenant artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("ciag")
  },

  "hospitality.artifact_registry.read": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Return the Hospitality tenant artifact registry.",
    handler: async ({ ctx }) => readRegistryFile("hospitality")
  }
  ,
  // PHASE20_TENANT_PARITY_TOOLS_V3
  "chc.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read CHC tenant artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("chc");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "chc.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Search CHC tenant artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("chc");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },

  "ciag.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read CIAG tenant artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("ciag");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "ciag.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Search CIAG tenant artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("ciag");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },

  "hospitality.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read Hospitality tenant artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("hospitality");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "hospitality.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Search Hospitality tenant artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("hospitality");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  }


};

function toolsPayload() {
  return Object.entries(TOOL_REGISTRY)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({
      name,
      version: v.version || "1.0.0",
      description: v.description || ""
    }));
}

function capabilitiesPayload() {
  return {
    ok: true,
    schema: "mcp.capabilities.v1",
      contractVersion: CONTRACT_VERSION,
      minSupportedContractVersion: MIN_SUPPORTED_CONTRACT_VERSION,
      contractVersion: "21C.1.0",
      optionalCtxFields: ["contractVersion"],
    requiredCtxFields: REQUIRED_CTX_FIELDS.slice(),
    tenants: TENANTS.slice(),
    namespaceAllowlistByTenant: TENANT_NAMESPACE_ALLOWLIST,
    tools: toolsPayload(),

  "chc.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read CHC artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("chc");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "chc.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Search CHC artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("chc");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },
  "ciag.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read CIAG artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("ciag");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "ciag.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Search CIAG artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("ciag");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  },
  "hospitality.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Read HOSPITALITY artifact by id.",
    handler: async ({ args, ctx }) => {
      if (!args || typeof args.id !== "string" || !args.id.trim()) throw new Error("Missing args.id");
      const reg = readRegistryFile("hospitality");
      const artifact = reg.artifacts.find((a) => a && a.id === args.id) || null;
      return { schema: "artifact-registry.readById.v1", tenant: ctx.tenant, id: args.id, artifact };
    }
  },
  "hospitality.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    description: "Search HOSPITALITY artifacts.",
    handler: async ({ args, ctx }) => {
      const q = (args && typeof args.q === "string") ? args.q : "";
      const reg = readRegistryFile("hospitality");
      const qq = q.trim().toLowerCase();
      const hits = qq
        ? reg.artifacts.filter((a) => JSON.stringify(a).toLowerCase().includes(qq))
        : reg.artifacts;
      return { schema: "artifact-registry.search.v1", tenant: ctx.tenant, q, count: hits.length, artifacts: hits };
    }
  }

  };
}

function handleToolCall(req, res, body) {
  const { tool, args, ctx } = body || {};
  if (!tool || typeof tool !== "string") return toolError(res, 400, "BAD_REQUEST", "Missing tool (string).");
  if (!args || typeof args !== "object") return toolError(res, 400, "BAD_REQUEST", "Missing args (object).");
  if (!ctx || typeof ctx !== "object") return toolError(res, 400, "BAD_REQUEST", "Missing ctx (object).");

  try {
    assertCtx(ctx);
    /* PHASE21B_CONTRACT_ENFORCEMENT */
    const expectedContractVersion = "21A.1.0";
    if (!ctx.contractVersion || typeof ctx.contractVersion !== "string" || !ctx.contractVersion.trim()) {
      return toolError(
        res,
        400,
        "CONTRACT_VERSION_REQUIRED",
        "Missing ctx.contractVersion.",
        ctx.traceId,
        { expected: expectedContractVersion }
      );
    }
    if (ctx.contractVersion !== expectedContractVersion) {
      return toolError(
        res,
        409,
        "CONTRACT_VERSION_MISMATCH",
        "Unsupported ctx.contractVersion.",
        ctx.traceId,
        { expected: expectedContractVersion, got: ctx.contractVersion }
      );
    }
  } catch (e) {
    return toolError(res, 400, "BAD_REQUEST", e.message || "Invalid ctx.");
  }

  if (!isToolAllowed(tool, ctx.tenant)) {
    return toolError(res, 403, "FORBIDDEN", "Tool not allowed for tenant.", ctx.traceId, { tool, tenant: ctx.tenant });
  }

  const entry = TOOL_REGISTRY[tool];

    // ---- Phase 21C: per-tool minContractVersion gate ----
    if (entry?.minContractVersion) {
      const client = ctx.contractVersion || "0.0.0";
      if (client < entry.minContractVersion) {
        return toolError(
          res,
          409,
          "CONTRACT_VERSION_TOO_LOW",
          "Tool requires newer contractVersion.",
          ctx.traceId,
          {
            tool,
            expected: entry.minContractVersion,
            received: client
          }
        );
      }
    }

  if (!entry) {
    return toolError(res, 404, "TOOL_NOT_FOUND", "Unknown tool", ctx.traceId, { tool });
  }

  Promise.resolve()
    .then(() => entry.handler({ tool, args, ctx }))
    .then((data) => json(res, 200, { ok: true, data, meta: { traceId: ctx.traceId } }))
    .catch((e) => toolError(res, 500, "INTERNAL", e && e.message ? e.message : "Tool execution failed.", ctx.traceId));
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url || "", true);

  if (req.method === "GET" && parsed.pathname === "/health") {
    return json(res, 200, { ok: true, service: "mcp-shared-server", status: "healthy" });
  }

  if (req.method === "GET" && parsed.pathname === "/tools") {
    return json(res, 200, { ok: true, schema: "mcp.tools-registry.v1", tools: toolsPayload() });
  }

  if (req.method === "GET" && parsed.pathname === "/capabilities") {
    return json(res, 200, capabilitiesPayload());
  }

  if (req.method === "POST" && parsed.pathname === "/tool") {
    let buf = "";
    req.on("data", (chunk) => { buf += chunk; });
    req.on("end", () => {
      try {
        const body = buf ? JSON.parse(buf) : {};
        return handleToolCall(req, res, body);
      } catch {
        return toolError(res, 400, "BAD_REQUEST", "Invalid JSON.");
      }
    });
    return;
  }

  return toolError(res, 404, "NOT_FOUND", "Route not found");
});

server.listen(PORT, () => {
  console.log("mcp-shared-server listening on :" + PORT);
  console.log("MCP registry keys:", Object.keys(TOOL_REGISTRY).sort());
});


/* PHASE20_V3_1_TENANT_PARITY */
Object.assign(TOOL_REGISTRY, {
  "chc.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    handler: async ({ args, ctx }) => {
      const reg = readRegistryFile("chc");
      const artifact = reg.artifacts.find(a => a?.id === args?.id) || null;
      return { id: args.id, artifact };
    }
  },
  "chc.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    handler: async ({ args, ctx }) => {
      const q = (args?.q || "").toLowerCase();
      const reg = readRegistryFile("chc");
      const hits = q ? reg.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q)) : reg.artifacts;
      return { q, count: hits.length, artifacts: hits };
    }
  },

  "ciag.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    handler: async ({ args }) => {
      const reg = readRegistryFile("ciag");
      const artifact = reg.artifacts.find(a => a?.id === args?.id) || null;
      return { id: args.id, artifact };
    }
  },
  "ciag.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    handler: async ({ args }) => {
      const q = (args?.q || "").toLowerCase();
      const reg = readRegistryFile("ciag");
      const hits = q ? reg.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q)) : reg.artifacts;
      return { q, count: hits.length, artifacts: hits };
    }
  },

  "hospitality.artifact_registry.readById": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    handler: async ({ args }) => {
      const reg = readRegistryFile("hospitality");
      const artifact = reg.artifacts.find(a => a?.id === args?.id) || null;
      return { id: args.id, artifact };
    }
  },
  "hospitality.artifact_registry.search": {
    version: "1.0.0",
      minContractVersion: "21A.1.0",
    handler: async ({ args }) => {
      const q = (args?.q || "").toLowerCase();
      const reg = readRegistryFile("hospitality");
      const hits = q ? reg.artifacts.filter(a => JSON.stringify(a).toLowerCase().includes(q)) : reg.artifacts;
      return { q, count: hits.length, artifacts: hits };
    }
  }
});
