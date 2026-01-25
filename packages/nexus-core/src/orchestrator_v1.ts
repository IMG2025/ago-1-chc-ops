import type {
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
