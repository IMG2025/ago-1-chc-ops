#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("RUNTIME_AUTH_HARDENING_GATE")) {
  console.log("OK: runtime authorize hardening already present (no-op).");
  process.exit(0);
}

// Locate authorize method block
const rxAuthorize =
  /(authorize\s*\(\s*domain_id\s*:\s*string\s*,\s*task\s*:\s*any\s*,\s*scope\s*:\s*string\s*\)\s*:\s*void\s*\{\n)([\s\S]*?\n)(\}\n)/m;

const m = src.match(rxAuthorize);
if (!m) {
  console.error("ERROR: Could not locate authorize(domain_id: string, task: any, scope: string): void { ... } block.");
  process.exit(1);
}

const head = m[1];
let body = m[2];
const tail = m[3];

// Anchor: insert immediately after UNKNOWN_DOMAIN guard.
// We look for either:
//   if (!spec) throw chcOpsError("UNKNOWN_DOMAIN", ...);
// or a multiline block that throws UNKNOWN_DOMAIN.
const rxUnknownDomain =
  /(\n\s*(?:if\s*\(\s*!spec\s*\)\s*\{[\s\S]*?\n\s*\}|\s*if\s*\(\s*!spec\s*\)\s*throw\s+chcOpsError\(\s*["']UNKNOWN_DOMAIN["'][\s\S]*?;\s*)\n)/m;

const um = body.match(rxUnknownDomain);
if (!um) {
  console.error("ERROR: Could not find UNKNOWN_DOMAIN guard inside authorize() to anchor insertion.");
  process.exit(1);
}

const insert = `${um[1]}
    // RUNTIME_AUTH_HARDENING_GATE:
    // Defense-in-depth: re-assert spec invariants at decision time.
    // (If a spec is mutated post-registration, we fail deterministically.)
    validateScopeNamespaces(spec);
    validateActionScopesSubset(spec);

    // Scope namespace must match domain_id.
    if (typeof scope !== "string" || !scope.startsWith(domain_id + ":")) {
      throw chcOpsError("INVALID_SCOPE_NAMESPACE", {
        domain_id,
        task_type: taskType,
        scope,
        note: "scope must be namespaced as <domain_id>:*",
      });
    }
`;

// Replace the first occurrence only
body = body.replace(rxUnknownDomain, insert);

// Write back
const next = src.replace(rxAuthorize, `${head}${body}${tail}`);
fs.writeFileSync(FILE, next);

console.log("Patched: authorize() now enforces runtime spec invariants + scope namespace gate.");
