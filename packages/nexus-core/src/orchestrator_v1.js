import { defaultRoutingPolicy } from "./orchestration.js";
function isoNow() {
    return new Date().toISOString();
}
function asErrorLike(e) {
    if (typeof e === "object" && e !== null)
        return e;
    return { message: String(e) };
}
export class NexusOrchestrator {
    adapters = [];
    policy;
    constructor(policy = defaultRoutingPolicy) {
        this.policy = policy;
    }
    registerAdapter(adapter) {
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
    listAdapters() {
        return this.adapters.slice();
    }
    route(envelope) {
        return this.policy({ envelope, adapters: this.adapters });
    }
    async dispatch(envelope) {
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
        }
        catch (e) {
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
//# sourceMappingURL=orchestrator_v1.js.map