import type { ExecutorSpec } from "./contracts/executor.js";

export const hospitalityExecutorSpec: ExecutorSpec = {
  domain_id: "hospitality",
  executor_id: "hospitalityExecutor",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["hospitality:execute"],
    ANALYZE: ["hospitality:analyze"],
    ESCALATE: ["hospitality:escalate"],
  },
  domain_action_scopes: {
    RATE_UPDATE: ["hospitality:execute"],
    TARIFF_SYNC: ["hospitality:execute"],
    VENDOR_INVOICE_CHECK: ["hospitality:execute"],
  },
  validate_inputs: (raw: unknown) => raw,
  execute: (raw: unknown) => ({ status: "STUB_OK", raw }),
};

export const ciagExecutorSpec: ExecutorSpec = {
  domain_id: "ciag",
  executor_id: "ciagExecutor",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["ciag:execute"],
    ANALYZE: ["ciag:analyze"],
    ESCALATE: ["ciag:escalate"],
  },
  validate_inputs: (raw: unknown) => raw,
  execute: (raw: unknown) => ({ status: "STUB_OK", raw }),
};


/**
 * CHC Ops executor spec (Step 9)
 * Keep this aligned with DomainRegistry expectations (domain_id + task types + required scopes).
 */
export const chcExecutorSpec = {
  domain_id: "chc",
  name: "CHC Ops",
  version: "v1",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["chc:execute"],
    ANALYZE: ["chc:analyze"],
    ESCALATE: ["chc:escalate"],
  },
};
