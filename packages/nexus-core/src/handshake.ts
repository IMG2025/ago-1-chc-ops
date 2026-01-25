/**
 * Sentinel ↔ Nexus Handshake Contract (v1)
 *
 * Purpose:
 * - Provide a stable seam between Sentinel (governance/authorization + executor registry)
 *   and Nexus (orchestration/routing).
 *
 * Guardrails:
 * - Types-first boundary. Avoid runtime coupling to Sentinel internals.
 * - No deep imports. Consumers must import from "@chc/sentinel-core" and "@chc/nexus-core" only.
 * - Do NOT broaden this surface without adding an explicit v2 file and migration plan.
 */

import type { ExecutorSpec, TaskType } from "@chc/sentinel-core";

/**
 * Nexus operates on an envelope; Sentinel authorizes + validates based on domain/task/scope.
 * We intentionally keep payload unknown to prevent coupling.
 */
export interface NexusTaskEnvelope {
  task_id: string;
  domain_id: string;
  task_type: TaskType | string;
  payload: unknown;
  scopes?: readonly string[];
  meta?: Readonly<Record<string, unknown>>;
}

/**
 * Sentinel-facing registrar callback. Nexus uses this shape to mount plugins.
 * This mirrors plugin authoring style: register(spec).
 */
export type SentinelRegistrar = (spec: ExecutorSpec) => void;

/**
 * Minimal Sentinel capabilities Nexus is allowed to depend on.
 * This is the "governance gate + registry lookup" seam.
 */
export interface SentinelGateway {
  /**
   * Register a domain executor specification into Sentinel.
   * MUST enforce Sentinel invariants (scope namespace rules, subset gates, etc.) within Sentinel.
   */
  registerExecutor(spec: ExecutorSpec): void;

  /**
   * Authorize a task execution path.
   * Sentinel owns the rules. Nexus treats the return value as opaque.
   * If authorization fails, Sentinel MUST throw a typed error.
   */
  authorize(domain_id: string, task: unknown, scope: string): unknown;

  /**
   * Retrieve a registered executor spec by domain.
   * Nexus uses this to route calls after authorization.
   */
  get(domain_id: string): ExecutorSpec | undefined;

  /**
   * List mounted domains for diagnostics.
   */
  listDomains(): readonly string[];
}

/**
 * Nexus-facing plugin mount function.
 * This is the only supported "mount" integration seam:
 * Sentinel (or CHC Ops runtime) supplies a registrar callback, plugins call register(spec).
 */
export type NexusMountFn = (register: SentinelRegistrar) => void;

/**
 * Optional helper: mount plugins into a SentinelGateway.
 * This is intentionally tiny; most behavior lives in Sentinel.
 */
export function mountPluginsIntoSentinel(gateway: Pick<SentinelGateway, "registerExecutor">, mount: NexusMountFn): void {
  mount((spec) => gateway.registerExecutor(spec));
}

