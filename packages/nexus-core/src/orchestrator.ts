/**
 * Nexus Core — Orchestration Contract (Public Surface v1)
 *
 * Guardrail: this file defines the ONLY stable orchestration seam.
 * - No deep-import consumers should rely on internals outside index.ts.
 * - Keep types minimal and forward-compatible.
 */

export type TaskId = string;
export type DomainId = string;
export type TaskType = string;

/**
 * Minimal envelope that Nexus can route and orchestrate.
 * We keep payload unknown to avoid coupling to domain internals.
 */
export interface TaskEnvelope {
  task_id: TaskId;
  domain_id: DomainId;
  task_type: TaskType;
  payload: unknown;
  /**
   * Optional scope/context for governance layers (Sentinel).
   * Nexus itself should not authorize; it should consume an already-authorized call path.
   */
  scopes?: readonly string[];
  meta?: Readonly<Record<string, unknown>>;
}

/**
 * Minimal orchestration result. Payload remains unknown to avoid coupling.
 */
export interface OrchestrationResult {
  task_id: TaskId;
  status: "OK" | "ERROR";
  output?: unknown;
  error?: {
    code: string;
    message: string;
    meta?: Readonly<Record<string, unknown>>;
  };
}

/**
 * Orchestrator interface — the stable behavioral surface.
 */
export interface Orchestrator {
  orchestrate(task: TaskEnvelope): Promise<OrchestrationResult> | OrchestrationResult;
}

/**
 * Minimal default orchestrator (placeholder).
 * This ensures the package compiles and provides a usable object for smoke tests,
 * without asserting runtime behavior beyond contract shape.
 */
export const defaultOrchestrator: Orchestrator = {
  orchestrate(task: TaskEnvelope): OrchestrationResult {
    return { task_id: task.task_id, status: "ERROR", error: { code: "NOT_IMPLEMENTED", message: "Nexus orchestrator not implemented." } };
  },
};

