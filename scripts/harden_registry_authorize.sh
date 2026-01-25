#!/usr/bin/env bash
set -euo pipefail

FILE="src/registry.ts"

node - <<'NODE'
import fs from "fs";

const file = "src/registry.ts";
let s = fs.readFileSync(file, "utf8");

// Ensure imports exist
if (!s.includes('from "./errors.js"')) {
  // insert after first import line
  s = s.replace(
    /^import[^\n]*\n/m,
    (m) => `${m}import { chcOpsError, getTaskType } from "./errors.js";\n`
  );
}

// Remove assertAuthorized import if present (we are not using it in strict path)
s = s.replace(/^\s*import\s+\{\s*assertAuthorized\s*\}\s+from\s+["']\.\/authorize\.js["'];\s*\n/m, "");

// Replace authorize method implementation inside DomainRegistry class
// We match `authorize(` through the closing `}` at the same indent.
const authorizeRe = /\n\s*authorize\(\s*domain_id:\s*string\s*,\s*task:\s*any\s*,\s*scope:\s*string\s*\)\s*:\s*void\s*\{\s*[\s\S]*?\n\s*\}\s*\n/;

const strictAuthorize = `
  /**
   * Sentinel-aligned gate: validates task support + required scopes.
   * Deterministic. Throws with stable CHC Ops error codes.
   */
  authorize(domain_id: string, task: any, scope: string): void {
    const spec = this.get(domain_id);
    if (!spec) throw chcOpsError("UNKNOWN_DOMAIN", { domain_id });

    const taskType = getTaskType(task);

    // 1) Task type must be supported by this domain executor
    if (!spec.supported_task_types.includes(taskType)) {
      throw chcOpsError("UNSUPPORTED_TASK_TYPE", {
        domain_id,
        task_type: taskType,
        supported_task_types: spec.supported_task_types,
      });
    }

    // 2) Scope must be present in required_scopes[taskType] if defined
    const scopesForType = spec.required_scopes?.[taskType];
    if (Array.isArray(scopesForType) && scopesForType.length > 0) {
      if (!scopesForType.includes(scope)) {
        throw chcOpsError("MISSING_SCOPE", {
          domain_id,
          task_type: taskType,
          scope,
          required_scopes: scopesForType,
        });
      }
    } else {
      // If the domain says it supports the task type but doesn't define scopes for it,
      // treat it as a policy misconfig: require explicit allowlist.
      throw chcOpsError("MISSING_SCOPE", {
        domain_id,
        task_type: taskType,
        scope,
        required_scopes: scopesForType ?? [],
        note: "No required_scopes configured for this task_type.",
      });
    }
  }
`;

if (authorizeRe.test(s)) {
  s = s.replace(authorizeRe, `\n${strictAuthorize}\n`);
} else {
  // If not found, we insert it right before the end of the class as a fallback.
  s = s.replace(/\n\}\s*\n\nexport function createRegistry\(/, `\n${strictAuthorize}\n}\n\nexport function createRegistry(`);
}

fs.writeFileSync(file, s);
console.log("Hardened DomainRegistry.authorize() (strict checks + stable errors).");
NODE

npm run build
