#!/usr/bin/env node
/**
 * patch_phase5_refactor_chc_ops_to_core_mcp_v1.mjs
 * Idempotent patch:
 * - CHC Ops consumes MCP from ago-1-core (single authority)
 * - Removes local MCP TS implementation under src/mcp to prevent drift
 * - Re-exports core MCP via src/index.ts
 * - Adds compile-time proof module
 * - Runs npm install
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

function removeDirIfExists(dir) {
  if (!exists(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function upsertDependency(pkgPath, name, spec) {
  const pkg = JSON.parse(read(pkgPath));
  pkg.dependencies ||= {};
  if (pkg.dependencies[name] === spec) return { changed: false, pkg };
  pkg.dependencies[name] = spec;
  return { changed: true, pkg };
}

function ensureExportInIndex(indexPath) {
  if (!exists(indexPath)) return false;
  const prev = read(indexPath);

  // Remove legacy local MCP export if present
  const withoutLocal = prev
    .split(/\r?\n/)
    .filter((line) => line.trim() !== 'export * as mcp from "./mcp";')
    .join("\n");

  // Ensure we re-export core MCP
  const exportLine = 'export { mcp } from "ago-1-core";';
  const lines = withoutLocal.split(/\r?\n/);
  const has = lines.some((l) => l.trim() === exportLine);

  const next = (has ? withoutLocal : (withoutLocal.replace(/\s*$/, "") + "\n" + exportLine + "\n"));
  return writeIfChanged(indexPath, next);
}

function main() {
  console.log("== Phase 5: Refactor CHC Ops to consume core MCP ==");

  const changed = [];

  // 1) Add dependency
  const pkgPath = p("package.json");
  if (!exists(pkgPath)) throw new Error("package.json not found");

  const CORE_SPEC = "github:IMG2025/ago-1-core#master";
  const { changed: depChanged, pkg } = upsertDependency(pkgPath, "ago-1-core", CORE_SPEC);
  if (depChanged) {
    if (writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n")) {
      changed.push("package.json (deps: ago-1-core)");
    }
  }

  // 2) Remove local MCP TS implementation (single authority now)
  const localMcpDir = p("src", "mcp");
  if (removeDirIfExists(localMcpDir)) {
    changed.push("src/mcp/ (removed; now provided by ago-1-core)");
  }

  // 3) Ensure CHC Ops re-exports MCP from core
  const indexPath = p("src", "index.ts");
  if (ensureExportInIndex(indexPath)) {
    changed.push("src/index.ts (re-export mcp from ago-1-core)");
  }

  // 4) Add compile-time proof module (no runtime execution)
  const proofTs = `/**
 * CHC Ops Phase 5 — Compile-Time Proof (MCP via ago-1-core)
 *
 * This file intentionally does NOT execute at runtime.
 * It proves CHC Ops can build a valid MCP tool request using the core Nexus plane.
 */
import { mcp } from "ago-1-core";

export function chcOpsMcpCompileProof() {
  const transport = mcp.createHttpToolTransport({ baseUrl: "http://127.0.0.1:8787" });

  const req: mcp.ToolRequest = {
    tool: "shared.artifact_registry.read",
    args: {},
    ctx: {
      tenant: "shared",
      actor: "ago-1-chc-ops",
      purpose: "chc-ops-phase5-compile-proof",
      classification: "internal",
      traceId: "chc-ops-compile-proof"
    }
  };

  void mcp.callTool(transport, req);
}
`;
  if (writeIfChanged(p("src", "mcp_phase5_compile_proof.ts"), proofTs)) {
    changed.push("src/mcp_phase5_compile_proof.ts");
  }

  console.log("Changed files:", changed.length ? changed : "(no changes; already applied)");

  console.log("== Installing deps (required after package.json change) ==");
  run("npm install --no-audit --no-fund");

  console.log("== Running build (required) ==");
  run("npm run build");

  console.log("== Patch complete ==");
}

main();
