#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const GEN = "scripts/patch_step_7_lock_nexus_orchestration_v2.mjs";
const ORCH = "packages/nexus-core/src/orchestrator_v1.ts";
const PKG = "packages/nexus-core";

if (!fs.existsSync(GEN)) throw new Error(`Missing: ${GEN}`);
if (!fs.existsSync(PKG)) throw new Error(`Missing: ${PKG}`);

ensureDir(path.dirname(ORCH));

const canonicalOrchestratorV1 = `import type {
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

type ErrorLike = Readonly<{ code?: string; meta?: unknown; message?: string }>;

function asErrorLike(e: unknown): ErrorLike {
  if (typeof e === "object" && e !== null) return e as ErrorLike;
  return { message: String(e) };
}

export class NexusOrchestrator implements Orchestrator {
  private adapters: ExecutorAdapter[] = [];
  private policy: RoutingPolicy;

  constructor(policy: RoutingPolicy = defaultRoutingPolicy) {
    this.policy = policy;
  }

  registerAdapter(adapter: ExecutorAdapter): void {
    if (this.adapters.some(a => a.executor_id === adapter.executor_id)) {
      const err = new Error("DUPLICATE_EXECUTOR");
      // @ts-expect-error attach metadata
      err.code = "DUPLICATE_EXECUTOR";
      // @ts-expect-error attach metadata
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
    } catch (e: unknown) {
      const err = asErrorLike(e);
      return {
        task_id: envelope.task_id,
        domain_id: envelope.domain_id,
        task_type: envelope.task_type,
        status: "FAILED",
        error_code: err.code ?? "EXECUTOR_FAILED",
        error_meta: err.meta ?? { message: String(err.message ?? e) },
        finished_at: isoNow(),
      };
    }
  }
}
`;

writeIfChanged(ORCH, canonicalOrchestratorV1.trimEnd() + "\n");

// Patch generator to emit this exact canonical content (no regex splicing).
let g = read(GEN);

const marker = "const orchestratorImplTs = `";
const start = g.indexOf(marker);
if (start < 0) throw new Error("Invariant: could not find orchestratorImplTs in generator.");

const tplStart = start + marker.length;
const tplEnd = g.indexOf("`;", tplStart);
if (tplEnd < 0) throw new Error("Invariant: could not find end of orchestratorImplTs template in generator.");

const escapedForTemplate = canonicalOrchestratorV1
  .replace(/`/g, "\\`"); // protect template literal

const nextG =
  g.slice(0, tplStart) +
  escapedForTemplate +
  g.slice(tplEnd);

writeIfChanged(GEN, nextG);

console.log("OK: Step 7 restored canonical orchestrator_v1.ts and pinned generator template (syntax-safe, strict-safe).");

// Re-run Step 7 generator twice for idempotency and to ensure it does not re-break anything
run("node scripts/patch_step_7_lock_nexus_orchestration_v2.mjs");
run("node scripts/patch_step_7_lock_nexus_orchestration_v2.mjs");

// Full gates
run("npm test");
run("npm run build");
