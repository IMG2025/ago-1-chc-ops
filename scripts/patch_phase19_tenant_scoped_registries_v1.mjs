#!/usr/bin/env node
/**
 * Phase 19 — Tenant-scoped registries (v1)
 * - Create tenant registry files (if missing) seeded from shared + tenant marker artifacts
 * - Wire tenant registry tools in mcp-shared-server to read correct tenant file
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
  return false;
}
function mustExist(p) {
  if (!fs.existsSync(p)) {
    console.error("Missing:", p);
    process.exit(1);
  }
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const dataDir = path.join(ROOT, "data");
const sharedPath = path.join(dataDir, "artifacts.shared.json");
const tenantPaths = {
  chc: path.join(dataDir, "artifacts.chc.json"),
  ciag: path.join(dataDir, "artifacts.ciag.json"),
  hospitality: path.join(dataDir, "artifacts.hospitality.json"),
};

const serverPath = path.join(ROOT, "services", "mcp-shared-server", "server.mjs");

mustExist(sharedPath);
mustExist(serverPath);

let changed = false;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function stableNow() {
  // deterministic-ish timestamp is not required for files; keep constant
  return "1970-01-01T00:00:00.000Z";
}

function markerArtifact(tenant) {
  const upper = tenant.toUpperCase();
  return {
    id: `TENANT-SEED-${upper}`,
    name: `Tenant Seed Marker (${upper})`,
    version: "v1.0",
    status: "locked",
    owner: upper,
    pathHint: `data/artifacts.${tenant}.json#TENANT-SEED-${upper}`,
  };
}

function ensureTenantFile(tenant, fp) {
  if (fs.existsSync(fp)) {
    // Ensure marker exists (idempotent insert if missing)
    const data = loadJson(fp);
    const artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
    const marker = markerArtifact(tenant);
    const has = artifacts.some(a => a && a.id === marker.id);
    if (!has) {
      const next = {
        schema: data.schema || "artifact-registry.v1",
        tenant,
        generatedAt: data.generatedAt || stableNow(),
        artifacts: [marker, ...artifacts],
      };
      fs.writeFileSync(fp, JSON.stringify(next, null, 2) + "\n");
      console.log("Updated tenant registry (added marker):", fp);
      return true;
    }
    return false;
  }

  const shared = loadJson(sharedPath);
  const artifacts = Array.isArray(shared.artifacts) ? shared.artifacts : [];
  const marker = markerArtifact(tenant);

  const next = {
    schema: shared.schema || "artifact-registry.v1",
    tenant,
    generatedAt: stableNow(),
    artifacts: [marker, ...artifacts],
  };

  fs.writeFileSync(fp, JSON.stringify(next, null, 2) + "\n");
  console.log("Created tenant registry:", fp);
  return true;
}

// 1) Create/normalize tenant files
for (const [tenant, fp] of Object.entries(tenantPaths)) {
  if (ensureTenantFile(tenant, fp)) changed = true;
}

// 2) Wire server.mjs tenant tool handlers to read tenant-specific file
let src = read(serverPath);

// Guardrail: ensure the tenant tools exist in TOOL_REGISTRY
for (const tool of [
  "shared.artifact_registry.read",
  "chc.artifact_registry.read",
  "ciag.artifact_registry.read",
  "hospitality.artifact_registry.read",
]) {
  if (!src.includes(`"${tool}"`)) {
    console.error("Expected tool missing in server.mjs TOOL_REGISTRY:", tool);
    process.exit(1);
  }
}

// Ensure tenant path constants exist (idempotent insert near existing SHARED path)
const needConsts =
  !src.includes("const TENANT_ARTIFACTS_PATHS") ||
  !src.includes("function artifactsPathForTenant");

if (needConsts) {
  // Insert after SHARED_ARTIFACTS_PATH declaration if present; otherwise after last import.
  const insertBlock = `
const TENANT_ARTIFACTS_PATHS = {
  chc: ${JSON.stringify(tenantPaths.chc)},
  ciag: ${JSON.stringify(tenantPaths.ciag)},
  hospitality: ${JSON.stringify(tenantPaths.hospitality)}
};

function artifactsPathForTenant(tenant) {
  if (tenant === "shared") return SHARED_ARTIFACTS_PATH;
  return TENANT_ARTIFACTS_PATHS[tenant] || SHARED_ARTIFACTS_PATH;
}
`.trim() + "\n\n";

  const sharedIdx = src.indexOf("const SHARED_ARTIFACTS_PATH");
  if (sharedIdx >= 0) {
    const lineEnd = src.indexOf("\n", sharedIdx);
    src = src.slice(0, lineEnd + 1) + insertBlock + src.slice(lineEnd + 1);
  } else {
    const importMatches = [...src.matchAll(/^import .*;$/gm)];
    if (!importMatches.length) {
      console.error("No import section found; unsafe to patch server.mjs.");
      process.exit(1);
    }
    const last = importMatches[importMatches.length - 1];
    const after = last.index + last[0].length;
    src = src.slice(0, after) + "\n\n" + insertBlock + src.slice(after);
  }
  changed = true;
}

// Patch tenant tool handlers to use artifactsPathForTenant(ctx.tenant)
function patchToolReadHandler(toolName) {
  // Replace the first fs.readFileSync(PATH...) line inside that tool handler with tenant-aware resolution.
  // We do a bounded match from the tool key to the end of its handler function.
  const re = new RegExp(
    `("${toolName}"\\s*:\\s*\\{[\\s\\S]*?handler\\s*:\\s*async\\s*\\(\\{[\\s\\S]*?\\}\\)\\s*=>\\s*\\{)([\\s\\S]*?)(\\n\\s*\\}\\s*\\}\\s*,?)`,
    "m"
  );

  if (!re.test(src)) {
    console.error("Could not locate handler block for tool:", toolName);
    process.exit(1);
  }

  src = src.replace(re, (m, pre, body, post) => {
    // Ensure the handler reads the correct file
    const needleShared = "fs.readFileSync(SHARED_ARTIFACTS_PATH";
    const needleAnyRead = "fs.readFileSync(";

    let nextBody = body;

    // If already patched to artifactsPathForTenant, leave it.
    if (nextBody.includes("artifactsPathForTenant(")) return m;

    // Prefer explicit replace if it was using SHARED_ARTIFACTS_PATH
    if (nextBody.includes(needleShared)) {
      nextBody = nextBody.replace(
        needleShared,
        "fs.readFileSync(artifactsPathForTenant(ctx.tenant)"
      );
      return pre + nextBody + post;
    }

    // Otherwise replace first readFileSync(…) usage (best-effort)
    const idx = nextBody.indexOf(needleAnyRead);
    if (idx >= 0) {
      // Replace only the first occurrence safely
      nextBody = nextBody.replace(
        /fs\.readFileSync\(([^,]+),\s*"utf8"\)/,
        'fs.readFileSync(artifactsPathForTenant(ctx.tenant), "utf8")'
      );
      return pre + nextBody + post;
    }

    // If no file read exists, we add one at top of handler body (authoritative).
    const injected =
      `\n      const raw = fs.readFileSync(artifactsPathForTenant(ctx.tenant), "utf8");\n      const data = JSON.parse(raw);\n` +
      nextBody;

    return pre + injected + post;
  });

  return true;
}

// Apply to the tenant registry tools (including shared read is fine; it will resolve to shared path)
patchToolReadHandler("shared.artifact_registry.read");
patchToolReadHandler("chc.artifact_registry.read");
patchToolReadHandler("ciag.artifact_registry.read");
patchToolReadHandler("hospitality.artifact_registry.read");

// Ensure readById/search read from shared path ONLY (they’re shared tools by contract)
function enforceSharedReadInSharedTools(toolName) {
  const re = new RegExp(
    `("${toolName}"\\s*:\\s*\\{[\\s\\S]*?handler\\s*:\\s*async\\s*\\(\\{[\\s\\S]*?\\}\\)\\s*=>\\s*\\{)([\\s\\S]*?)(\\n\\s*\\}\\s*\\}\\s*,?)`,
    "m"
  );
  if (!re.test(src)) return;

  src = src.replace(re, (m, pre, body, post) => {
    // Make sure these always read SHARED_ARTIFACTS_PATH
    let nextBody = body;
    if (nextBody.includes("fs.readFileSync(") && !nextBody.includes("SHARED_ARTIFACTS_PATH")) {
      nextBody = nextBody.replace(
        /fs\.readFileSync\(([^,]+),\s*"utf8"\)/g,
        'fs.readFileSync(SHARED_ARTIFACTS_PATH, "utf8")'
      );
      changed = true;
    }
    return pre + nextBody + post;
  });
}
enforceSharedReadInSharedTools("shared.artifact_registry.readById");
enforceSharedReadInSharedTools("shared.artifact_registry.search");

if (writeIfChanged(serverPath, src)) changed = true;

if (!changed) console.log("No changes needed; already applied.");

console.log("== Running build (required) ==");
run("npm run build");
