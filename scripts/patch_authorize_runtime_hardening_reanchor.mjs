#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

if (!src.includes("RUNTIME_AUTH_HARDENING_GATE")) {
  console.log("OK: runtime hardening gate not present (no-op).");
  process.exit(0);
}

// Remove existing runtime hardening block
src = src.replace(
  /\/\/ RUNTIME_AUTH_HARDENING_GATE:[\s\S]*?note:\s*"scope must be namespaced as <domain_id>:\*",[\s\S]*?\}\);\n\s*\}/m,
  ""
);

// Reinsert after taskType derivation
const anchor = /const taskType\s*=\s*getTaskType\(task\);\s*\n/;

if (!anchor.test(src)) {
  console.error("ERROR: Could not find taskType anchor.");
  process.exit(1);
}

const insert = `
    // RUNTIME_AUTH_HARDENING_GATE:
    // Defense-in-depth: re-assert spec invariants at decision time.
    validateScopeNamespaces(spec);
    validateActionScopesSubset(spec);

    if (typeof scope !== "string" || !scope.startsWith(domain_id + ":")) {
      throw chcOpsError("INVALID_SCOPE_NAMESPACE", {
        domain_id,
        task_type: taskType,
        scope,
        note: "scope must be namespaced as <domain_id>:*",
      });
    }
`;

src = src.replace(anchor, match => match + insert);

fs.writeFileSync(FILE, src);
console.log("Patched: authorize() runtime hardening re-anchored after taskType.");
