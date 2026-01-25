import { orchestrate } from "../orchestrator.js";
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
