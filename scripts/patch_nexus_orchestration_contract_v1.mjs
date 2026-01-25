#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function writeIfChanged(file, next) {
  const prev = fs.existsSync(file) ? read(file) : "";
  if (prev !== next) fs.writeFileSync(file, next);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureFile(file, content) {
  ensureDir(path.dirname(file));
  writeIfChanged(file, content);
}

function fileExists(p) {
  return fs.existsSync(p);
}

function jsonRead(p) {
  return JSON.parse(read(p));
}

function jsonWriteStable(p, obj) {
  const next = JSON.stringify(obj, null, 2) + "\n";
  writeIfChanged(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const PKG_DIR = "packages/nexus-core";
const SRC_DIR = path.join(PKG_DIR, "src");

if (!fileExists(PKG_DIR)) {
  throw new Error("Invariant: packages/nexus-core does not exist. Step 4 must be completed first.");
}

// -----------------------------
// 1) Orchestration contract v1
// -----------------------------
const orchestratorTs = `/**
 * Nexus Orchestration Contract (v1)
 *
 * First-principles guardrails:
 * - Nexus orchestrates tasks; it does NOT own authorization semantics.
 * - Nexus may consult a governance gateway (Sentinel) via handshake contracts,
 *   but MUST remain usable in isolation for testing.
 * - This contract is intentionally minimal and stable.
 */

export type DomainId = string;
export type ExecutorId = string;
export type TaskType = string;

/**
 * Canonical task envelope for orchestration.
 * Nexus owns this structure.
 */
export type TaskEnvelope<TInput = unknown> = Readonly<{
  task_id: string;
  domain_id: DomainId;
  task_type: TaskType;
  requested_scope?: readonly string[]; // optional: requested scopes (governance decides)
  input: TInput;
  created_at: string; // ISO
}>;

/**
 * Canonical orchestration result.
 * Nexus returns a stable response shape regardless of executor.
 */
export type OrchestrationResult<TOutput = unknown> = Readonly<{
  task_id: string;
  domain_id: DomainId;
  task_type: TaskType;
  status: "SUCCEEDED" | "FAILED";
  output?: TOutput;
  error_code?: string;
  error_meta?: unknown;
  finished_at: string; // ISO
}>;

/**
 * Executor adapter contract.
 * Nexus routes envelopes to an executor implementation.
 */
export type ExecutorAdapter = Readonly<{
  executor_id: ExecutorId;
  domain_id: DomainId;
  supported_task_types: readonly TaskType[];
  execute: (envelope: TaskEnvelope) => Promise<unknown> | unknown;
}>;

/**
 * Routing policy contract.
 * Given an envelope and a set of adapters, select the executor.
 * This is deterministic and testable.
 */
export type RoutingPolicy = (args: Readonly<{
  envelope: TaskEnvelope;
  adapters: readonly ExecutorAdapter[];
}>) => ExecutorAdapter;

/**
 * Orchestrator contract.
 * Minimal: register adapters, route, dispatch, produce OrchestrationResult.
 */
export interface Orchestrator {
  registerAdapter(adapter: ExecutorAdapter): void;
  listAdapters(): readonly ExecutorAdapter[];
  route(envelope: TaskEnvelope): ExecutorAdapter;
  dispatch(envelope: TaskEnvelope): Promise<OrchestrationResult>;
}

/**
 * Default routing policy (v1):
 * - Choose first adapter that matches domain_id + supports task_type.
 * - Deterministic, minimal, safe.
 */
export const defaultRoutingPolicy: RoutingPolicy = ({ envelope, adapters }) => {
  const hit = adapters.find(
    a => a.domain_id === envelope.domain_id && a.supported_task_types.includes(envelope.task_type)
  );
  if (!hit) {
    const err: any = new Error("NO_ROUTE");
    err.code = "NO_ROUTE";
    err.meta = {
      domain_id: envelope.domain_id,
      task_type: envelope.task_type,
      adapters: adapters.map(a => ({ executor_id: a.executor_id, domain_id: a.domain_id, supported_task_types: a.supported_task_types })),
    };
    throw err;
  }
  return hit;
};
`;

ensureFile(path.join(SRC_DIR, "orchestration.ts"), orchestratorTs);

// --------------------------------------
// 2) Minimal orchestrator implementation
// --------------------------------------
const orchestratorImplTs = `import type {
  ExecutorAdapter,
  Orchestrator,
  OrchestrationResult,
  RoutingPolicy,
  TaskEnvelope,
} from "./orchestration.js";
import { defaultRoutingPolicy } from "./orchestration.js";

function isoNow() {
  return new Date().toISOString();
}

export class NexusOrchestrator implements Orchestrator {
  private adapters: ExecutorAdapter[] = [];
  private policy: RoutingPolicy;

  constructor(policy: RoutingPolicy = defaultRoutingPolicy) {
    this.policy = policy;
  }

  registerAdapter(adapter: ExecutorAdapter): void {
    // v1: allow multiple adapters; duplicates by executor_id are rejected
    if (this.adapters.some(a => a.executor_id === adapter.executor_id)) {
      const err: any = new Error("DUPLICATE_EXECUTOR");
      err.code = "DUPLICATE_EXECUTOR";
      err.meta = { executor_id: adapter.executor_id };
      throw err;
    }
    this.adapters.push(adapter);
  }

  listAdapters(): readonly ExecutorAdapter[] {
    return this.adapters.slice();
  }

  route(envelope: TaskEnvelope): ExecutorAdapter {
    return this.policy({ envelope, adapters: this.adapters });
  }

  async dispatch(envelope: TaskEnvelope): Promise<OrchestrationResult> {
    const exec = this.route(envelope);
    try {
      const out = await exec.execute(envelope);
      return {
        task_id: envelope.task_id,
        domain_id: envelope.domain_id,
        task_type: envelope.task_type,
        status: "SUCCEEDED",
        output: out,
        finished_at: isoNow(),
      };
    } catch (e: any) {
      return {
        task_id: envelope.task_id,
        domain_id: envelope.domain_id,
        task_type: envelope.task_type,
        status: "FAILED",
        error_code: e?.code ?? "EXECUTOR_FAILED",
        error_meta: e?.meta ?? { message: String(e?.message ?? e) },
        finished_at: isoNow(),
      };
    }
  }
}
`;

ensureFile(path.join(SRC_DIR, "orchestrator_v1.ts"), orchestratorImplTs);

// -----------------------------
// 3) Public surface (index.ts)
// -----------------------------
const indexTs = `// Nexus Core public surface (stable v1)
export type {
  DomainId,
  ExecutorId,
  TaskType,
  TaskEnvelope,
  OrchestrationResult,
  ExecutorAdapter,
  RoutingPolicy,
  Orchestrator,
} from "./orchestration.js";

export { defaultRoutingPolicy } from "./orchestration.js";
export { NexusOrchestrator } from "./orchestrator_v1.js";
`;

ensureFile(path.join(SRC_DIR, "index.ts"), indexTs);

// -----------------------------
// 4) Diagnostics smoke
// -----------------------------
const smokeTs = `import { NexusOrchestrator } from "../orchestrator_v1.js";
import type { ExecutorAdapter, TaskEnvelope } from "../orchestration.js";

const orch = new NexusOrchestrator();

const adapter: ExecutorAdapter = {
  executor_id: "nexus:test-exec",
  domain_id: "ciag",
  supported_task_types: ["EXECUTE"],
  execute: (env: TaskEnvelope) => ({ ok: true, echo: env.input }),
};

orch.registerAdapter(adapter);

const env: TaskEnvelope = {
  task_id: "task_test_001",
  domain_id: "ciag",
  task_type: "EXECUTE",
  input: { hello: "world" },
  created_at: new Date().toISOString(),
};

const res = await orch.dispatch(env);

if (res.status !== "SUCCEEDED") {
  console.error("FAIL: nexus-core smoke expected SUCCEEDED", res);
  process.exit(1);
}

console.log("OK: nexus-core smoke orchestration v1 => SUCCEEDED");
`;

ensureFile(path.join(SRC_DIR, "diagnostics", "smoke.ts"), smokeTs);

// -----------------------------
// 5) Package config sanity
// -----------------------------
const pkgJsonPath = path.join(PKG_DIR, "package.json");
const pkg = jsonRead(pkgJsonPath);

// ensure ESM + build script
pkg.type = "module";
pkg.scripts = pkg.scripts ?? {};
pkg.scripts.build = pkg.scripts.build || "tsc -p tsconfig.json";

// add a workspace-local smoke runner if desired (optional)
// keep minimal: do not add test runner dependency
pkg.scripts.smoke = pkg.scripts.smoke || "node ./dist/diagnostics/smoke.js";

jsonWriteStable(pkgJsonPath, pkg);

// -----------------------------
// 6) Ensure tsconfig emits diagnostics
// -----------------------------
const tsconfigPath = path.join(PKG_DIR, "tsconfig.json");
const tsconfig = jsonRead(tsconfigPath);

tsconfig.compilerOptions = tsconfig.compilerOptions ?? {};
tsconfig.compilerOptions.outDir = tsconfig.compilerOptions.outDir ?? "dist";
tsconfig.compilerOptions.rootDir = tsconfig.compilerOptions.rootDir ?? "src";
tsconfig.compilerOptions.module = "NodeNext";
tsconfig.compilerOptions.moduleResolution = "NodeNext";
tsconfig.compilerOptions.target = tsconfig.compilerOptions.target ?? "ES2022";
tsconfig.compilerOptions.declaration = true;
tsconfig.compilerOptions.strict = true;

jsonWriteStable(tsconfigPath, tsconfig);

console.log("OK: nexus-core orchestration contract v1 ensured (idempotent).");

// Gates: workspace build + root build
run("npm -w @chc/nexus-core run build");
run("npm run build");
