import { NexusOrchestrator } from "../orchestrator_v1.js";
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
