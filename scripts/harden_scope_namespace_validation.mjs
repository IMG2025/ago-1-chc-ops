#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";
const src = fs.readFileSync(FILE, "utf8");

if (src.includes("validateScopeNamespaces(")) {
  console.log("Scope namespace validation already present (no-op).");
  process.exit(0);
}

function insertAfterAnchor(text, anchor, addition) {
  const i = text.indexOf(anchor);
  if (i < 0) throw new Error(`Anchor not found: ${anchor}`);
  const j = i + anchor.length;
  return text.slice(0, j) + addition + text.slice(j);
}

// 1) Add helper function near top (after imports)
let next = src;
const importAnchor = src.match(/^import .*;\s*$/m)?.[0];
if (!importAnchor) throw new Error("No import anchor found in src/registry.ts");

const helper = `

function validateScopeNamespaces(spec: { domain_id: string; required_scopes?: Record<string, string[]>; domain_action_scopes?: Record<string, string[]>; supported_task_types: readonly string[] }) {
  const domain = spec.domain_id;

  // Task-type required scopes must exist and be domain-scoped.
  for (const t of spec.supported_task_types) {
    const scopes = spec.required_scopes?.[t] ?? [];
    if (!Array.isArray(scopes) || scopes.length === 0) {
      const err: any = new Error("MISSING_REQUIRED_SCOPES");
      err.code = "MISSING_REQUIRED_SCOPES";
      err.meta = { domain_id: domain, task_type: t, required_scopes: scopes, note: "required_scopes must be declared for all supported_task_types" };
      throw err;
    }
    for (const s of scopes) {
      if (typeof s !== "string" || !s.startsWith(domain + ":")) {
        const err: any = new Error("INVALID_SCOPE_NAMESPACE");
        err.code = "INVALID_SCOPE_NAMESPACE";
        err.meta = { domain_id: domain, task_type: t, scope: s, note: "task required_scopes must be namespaced as <domain_id>:*" };
        throw err;
      }
    }
  }

  // Domain-action scopes must also be domain-scoped.
  const actions = spec.domain_action_scopes ?? {};
  for (const [action, scopes] of Object.entries(actions)) {
    for (const s of scopes ?? []) {
      if (typeof s !== "string" || !s.startsWith(domain + ":")) {
        const err: any = new Error("INVALID_SCOPE_NAMESPACE");
        err.code = "INVALID_SCOPE_NAMESPACE";
        err.meta = { domain_id: domain, action, scope: s, note: "domain_action_scopes must be namespaced as <domain_id>:*" };
        throw err;
      }
    }
  }
}
`;

next = insertAfterAnchor(next, importAnchor, helper);

// 2) Call it inside registerExecutor (before storing spec)
const regAnchor = "registerExecutor(spec: ExecutorSpec)";
if (!next.includes(regAnchor)) throw new Error("registerExecutor anchor not found");

next = next.replace(
  /registerExecutor\(spec:\s*ExecutorSpec\)\s*\{\s*/m,
  (m) => m + "\n    validateScopeNamespaces(spec);\n"
);

fs.writeFileSync(FILE, next);
console.log("Added scope namespace validation to src/registry.ts");
