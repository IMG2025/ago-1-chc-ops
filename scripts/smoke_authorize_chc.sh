#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

node -e 'import("./dist/index.js").then(async (m)=>{ const { authorize } = m; const base = { domain_id:"chc", actor:{ subject_id:"u1", role:"operator" } }; const ok1 = authorize({ ...base, task_type:"EXECUTE", requested_scope:["chc:execute"] }); if (ok1.decision!=="ALLOW") throw new Error("expected ALLOW"); const ok2 = authorize({ ...base, task_type:"ANALYZE", requested_scope:["chc:read"] }); if (ok2.decision!=="ALLOW") throw new Error("expected ALLOW"); const ok3 = authorize({ ...base, task_type:"ESCALATE", requested_scope:["chc:escalate"] }); if (ok3.decision!=="ALLOW") throw new Error("expected ALLOW"); const bad = authorize({ ...base, task_type:"EXECUTE", requested_scope:["hospitality:execute"] }); if (bad.decision!=="DENY") throw new Error("expected DENY"); console.log("OK: authorize chc EXECUTE/ANALYZE/ESCALATE + cross-namespace deny"); }).catch(e=>{ console.error(e); process.exit(1); });'
