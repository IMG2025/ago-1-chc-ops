#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const PKG_DIR = path.join(ROOT, "packages/nexus-core");
const SRC_DIR = path.join(PKG_DIR, "src");
const DIAG_DIR = path.join(SRC_DIR, "diagnostics");
const DIST_DIR = path.join(PKG_DIR, "dist");
const PKG_JSON = path.join(PKG_DIR, "package.json");
const TSCONFIG = path.join(PKG_DIR, "tsconfig.json");
const INDEX = path.join(SRC_DIR, "index.ts");
const ORCH = path.join(SRC_DIR, "orchestrator.ts");
const DIAG = path.join(DIAG_DIR, "smoke.ts");

// 0) Ensure root package.json has workspaces covering packages/*
const ROOT_PKG = path.join(ROOT, "package.json");
const rootPkg = JSON.parse(read(ROOT_PKG));
rootPkg.workspaces ||= [];
const ws = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : (rootPkg.workspaces.packages || []);
const hasPackagesStar = ws.includes("packages/*");
if (!hasPackagesStar) {
  // Normalize to array form to keep it simple.
  const next = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces.slice() : [];
  next.push("packages/*");
  rootPkg.workspaces = Array.from(new Set(next)).sort();
  write(ROOT_PKG, JSON.stringify(rootPkg, null, 2) + "\n");
}

// 1) Create package.json (no rewrite if identical)
const pkgJsonOut = {
  name: "@chc/nexus-core",
  version: "0.0.1",
  private: true,
  type: "module",
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: {
    ".": {
      types: "./dist/index.d.ts",
      default: "./dist/index.js"
    }
  },
  scripts: {
    build: "tsc -p tsconfig.json"
  },
  dependencies: {
    "@chc/sentinel-core": "workspace:*"
  }
};

const pkgJsonStr = JSON.stringify(pkgJsonOut, null, 2) + "\n";
if (!exists(PKG_JSON) || read(PKG_JSON) !== pkgJsonStr) write(PKG_JSON, pkgJsonStr);

// 2) tsconfig.json
const tsconfigOut = {
  compilerOptions: {
    target: "ES2022",
    module: "ES2022",
    moduleResolution: "Bundler",
    declaration: true,
    outDir: "dist",
    rootDir: "src",
    strict: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    noImplicitAny: true
  },
  include: ["src/**/*.ts"]
};
const tsconfigStr = JSON.stringify(tsconfigOut, null, 2) + "\n";
if (!exists(TSCONFIG) || read(TSCONFIG) !== tsconfigStr) write(TSCONFIG, tsconfigStr);

// 3) Source files: minimal compile + sentinel-core barrel usage only
const orchOut = `import type { ExecutorSpec, TaskType } from "@chc/sentinel-core";

/**
 * Nexus Core (v0): orchestration contract.
 * This is intentionally minimal: we define the shape we will grow into.
 */
export type OrchestrationRequest = Readonly<{
  domain_id: string;
  task_type: TaskType;
  input: unknown;
  scopes: readonly string[];
}>;

export type OrchestrationResult = Readonly<{
  ok: true;
  output: unknown;
}> | Readonly<{
  ok: false;
  code: string;
  meta?: Record<string, unknown>;
}>;

/**
 * A registry surface Nexus expects.
 * Sentinel-core implements a compatible registry; we keep Nexus decoupled.
 */
export type ExecutorLookup = (domain_id: string) => ExecutorSpec | undefined;

/**
 * Minimal orchestrate function (no runtime coupling yet).
 * We will replace this with policy-driven routing + audit trails.
 */
export function orchestrate(getExecutor: ExecutorLookup, req: OrchestrationRequest): OrchestrationResult {
  const spec = getExecutor(req.domain_id);
  if (!spec) return { ok: false, code: "UNKNOWN_DOMAIN", meta: { domain_id: req.domain_id } };
  // NOTE: no execution here yet; Nexus will route to domain executors later.
  return { ok: true, output: { routed: spec.executor_id, task_type: req.task_type } };
}
`;
if (!exists(ORCH) || read(ORCH) !== orchOut) write(ORCH, orchOut);

const indexOut = `export * from "./orchestrator.js";\n`;
if (!exists(INDEX) || read(INDEX) !== indexOut) write(INDEX, indexOut);

// 4) Minimal diagnostics file (kept internal; compiled)
const diagOut = `import { orchestrate } from "../orchestrator.js";
import type { ExecutorSpec } from "@chc/sentinel-core";

const fake: ExecutorSpec = {
  domain_id: "ciag",
  executor_id: "ciag.v0",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: { EXECUTE: ["ciag:exec"], ANALYZE: ["ciag:analyze"], ESCALATE: ["ciag:escalate"] },
  validate_inputs: (raw: unknown) => raw,
  execute: (raw: unknown) => raw,
};

const res = orchestrate(
  (id) => (id === "ciag" ? fake : undefined),
  { domain_id: "ciag", task_type: "EXECUTE", input: { x: 1 }, scopes: ["ciag:exec"] }
);

if (!res.ok) throw new Error("expected ok");
console.log("OK: nexus-core smoke (minimal) compiled + ran shape check.");
`;
if (!exists(DIAG) || read(DIAG) !== diagOut) write(DIAG, diagOut);

// 5) Ensure package is included in root install graph
console.log("OK: packages/nexus-core scaffold ensured (minimal, compiling).");

// Gates: build the workspace and then the root build
run("npm -w @chc/nexus-core run build");
run("npm run build");
