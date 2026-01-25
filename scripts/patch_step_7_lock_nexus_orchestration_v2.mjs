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
function ensureFile(p, content) { ensureDir(path.dirname(p)); writeIfChanged(p, content); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const PKG_DIR = "packages/nexus-core";
const SRC_DIR = path.join(PKG_DIR, "src");
const IDX = path.join(SRC_DIR, "index.ts");
const HANDSHAKE = path.join(SRC_DIR, "handshake.ts");

if (!fs.existsSync(PKG_DIR)) throw new Error("Invariant: packages/nexus-core missing.");
if (!fs.existsSync(HANDSHAKE)) throw new Error(`Invariant: missing handshake contract: ${HANDSHAKE}`);

// -----------------------------
// Step 7: Orchestration v1 lock
// -----------------------------
const orchestrationTs = `/**
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

export type TaskEnvelope<TInput = unknown> = Readonly<{
  task_id: string;
  domain_id: DomainId;
  task_type: TaskType;
  requested_scope?: readonly string[];
  input: TInput;
  created_at: string; // ISO
}>;

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

export type ExecutorAdapter = Readonly<{
  executor_id: ExecutorId;
  domain_id: DomainId;
  supported_task_types: readonly TaskType[];
  execute: (envelope: TaskEnvelope) => Promise<unknown> | unknown;
}>;

export type RoutingPolicy = (args: Readonly<{
  envelope: TaskEnvelope;
  adapters: readonly ExecutorAdapter[];
}>) => ExecutorAdapter;

export interface Orchestrator {
  registerAdapter(adapter: ExecutorAdapter): void;
  listAdapters(): readonly ExecutorAdapter[];
  route(envelope: TaskEnvelope): ExecutorAdapter;
  dispatch(envelope: TaskEnvelope): Promise<OrchestrationResult>;
}

export const defaultRoutingPolicy: RoutingPolicy = ({ envelope, adapters }) => {
  const hit = adapters.find(
    a => a.domain_id === envelope.domain_id && a.supported_task_types.includes(envelope.task_type)
  );
  if (!hit) {
    const err = new Error("NO_ROUTE");
    // @ts-expect-error attach metadata
    err.code = "NO_ROUTE";
    // @ts-expect-error attach metadata
    err.meta = {
      domain_id: envelope.domain_id,
      task_type: envelope.task_type,
      adapters: adapters.map(a => ({
        executor_id: a.executor_id,
        domain_id: a.domain_id,
        supported_task_types: a.supported_task_types,
      })),
    };
    throw err;
  }
  return hit;
};
`;
ensureFile(path.join(SRC_DIR, "orchestration.ts"), orchestrationTs);

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
ensureFile(path.join(SRC_DIR, "orchestrator_v1.ts"), orchestratorImplTs);

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
  throw new Error("FAIL: nexus-core smoke expected SUCCEEDED");
}
console.log("OK: nexus-core smoke orchestration v1 => SUCCEEDED");
`;
ensureFile(path.join(SRC_DIR, "diagnostics", "smoke.ts"), smokeTs);

// ------------------------------------------
// Compose index.ts: orchestration + handshake
// ------------------------------------------

// Extract named exports from handshake.ts (types/interfaces) in a conservative way.
// We only include `export type` and `export interface` and `export const` names.
const hsSrc = read(HANDSHAKE);
const names = new Set();

// export type X = ...; | export interface X { ... } | export const X = ...
for (const m of hsSrc.matchAll(/^\s*export\s+type\s+([A-Za-z0-9_]+)\b/gm)) names.add(m[1]);
for (const m of hsSrc.matchAll(/^\s*export\s+interface\s+([A-Za-z0-9_]+)\b/gm)) names.add(m[1]);
for (const m of hsSrc.matchAll(/^\s*export\s+const\s+([A-Za-z0-9_]+)\b/gm)) names.add(m[1]);

// Remove collisions with orchestration symbols we already export from orchestration.ts
const orchestrationSymbols = new Set([
  "DomainId",
  "ExecutorId",
  "TaskType",
  "TaskEnvelope",
  "OrchestrationResult",
  "ExecutorAdapter",
  "RoutingPolicy",
  "Orchestrator",
  "defaultRoutingPolicy",
  "NexusOrchestrator",
]);

const hsExports = [...names].filter(n => !orchestrationSymbols.has(n)).sort();

const header = `// Canonical Public Surface (v1)
// NOTE: This file is composed. Do not overwrite handshake exports.
`;

const bodyLines = [
  `export type {`,
  `  DomainId,`,
  `  ExecutorId,`,
  `  TaskType,`,
  `  TaskEnvelope,`,
  `  OrchestrationResult,`,
  `  ExecutorAdapter,`,
  `  RoutingPolicy,`,
  `  Orchestrator,`,
  `} from "./orchestration.js";`,
  ``,
  `export { defaultRoutingPolicy } from "./orchestration.js";`,
  `export { NexusOrchestrator } from "./orchestrator_v1.js";`,
  ``,
  `// Handshake surface (explicit; audit-gated)`,
];

if (hsExports.length) {
  bodyLines.push(`export type { ${hsExports.join(", ")} } from "./handshake.js";`);
} else {
  // Even if handshake contract changes, keep an explicit marker export line to satisfy audit intent.
  bodyLines.push(`// (no handshake named exports detected by parser)`);
}

bodyLines.push(`// HANDSHAKE_EXPORTS_EXPLICIT`);

const indexOut = header + bodyLines.join("\n") + "\n";

// Guardrail: no star exports
if (/^\s*export\s+\*\s+from\s+/m.test(indexOut)) throw new Error("Invariant: index contains star export.");

ensureFile(IDX, indexOut);

console.log("OK: Step 7 nexus-core orchestration v1 locked (v2 composed index keeps handshake).");

// Gates
run("npm -w @chc/nexus-core run build");
run("npm test");
run("npm run build");
