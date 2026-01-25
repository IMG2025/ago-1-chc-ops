import type { ExecutorAdapter, Orchestrator, OrchestrationResult, RoutingPolicy, TaskEnvelope } from "./orchestration.js";
export declare class NexusOrchestrator implements Orchestrator {
    private adapters;
    private policy;
    constructor(policy?: RoutingPolicy);
    registerAdapter(adapter: ExecutorAdapter): void;
    listAdapters(): readonly ExecutorAdapter[];
    route(envelope: TaskEnvelope): ExecutorAdapter;
    dispatch(envelope: TaskEnvelope): Promise<OrchestrationResult>;
}
//# sourceMappingURL=orchestrator_v1.d.ts.map