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
    RATE_UPDATE: ["hospitality:rates:write"],
    TARIFF_SYNC: ["hospitality:tariffs:sync"],
    VENDOR_INVOICE_CHECK: ["hospitality:invoices:read"],
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
