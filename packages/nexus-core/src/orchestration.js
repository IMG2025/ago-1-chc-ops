export const defaultRoutingPolicy = ({ envelope, adapters }) => {
    const hit = adapters.find(a => a.domain_id === envelope.domain_id && a.supported_task_types.includes(envelope.task_type));
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
//# sourceMappingURL=orchestration.js.map