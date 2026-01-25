#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";
const src = fs.readFileSync(FILE, "utf8");

if (src.includes("ACTION_SCOPES_SUBSET_GATE")) {
  console.log("OK: action scopes subset gate already present (no-op).");
  process.exit(0);
}

// 1) Ensure helper exists (insert after validateScopeNamespaces if present, else near top)
const helper = `
// ACTION_SCOPES_SUBSET_GATE:
// Sentinel-aligned: every domain_action_scopes entry must be in the allowed required_scopes universe.
function validateActionScopesSubset(spec: ExecutorSpec) {
  const domain = spec.domain_id;

  // Build allowlist = union of all required_scopes across supported_task_types.
  const allow = new Set<string>();
  for (const t of spec.supported_task_types) {
    const scopes = spec.required_scopes?.[t] ?? [];
    for (const s of scopes ?? []) allow.add(s);
  }

  const actions = spec.domain_action_scopes ?? {};
  for (const [action, scopes] of Object.entries(actions)) {
    for (const s of (scopes ?? [])) {
      // Namespacing is already validated separately, but keep this defensive.
      if (typeof s !== "string" || !s.startsWith(domain + ":")) {
        throw chOpsError("INVALID_SCOPE_NAMESPACE", {
          domain_id: domain,
          action,
          scope: s,
          note: "domain_action_scopes must be namespaced as <domain_id>:*",
        });
      }
      if (!allow.has(s)) {
        throw chOpsError("ACTION_SCOPE_NOT_ALLOWED", {
          domain_id: domain,
          action,
          scope: s,
          allowed_scopes: Array.from(allow).sort(),
          note: "domain_action_scopes must be a subset of required_scopes (union across supported_task_types).",
        });
      }
    }
  }
}
`;

let next = src;

// Try to insert helper right after validateScopeNamespaces if present.
if (next.includes("function validateScopeNamespaces")) {
  const rx = /(function\s+validateScopeNamespaces\s*\([\s\S]*?\n\}\n)/m;
  const m = next.match(rx);
  if (!m) {
    console.error("ERROR: Found validateScopeNamespaces but could not anchor insertion.");
    process.exit(1);
  }
  next = next.replace(rx, `$1\n${helper}\n`);
} else {
  // Fallback: insert after imports (first blank line after imports)
  const rx = /^([\s\S]*?\n)\n/m;
  next = next.replace(rx, `$1\n${helper}\n`);
}

// 2) Ensure registerExecutor calls it (after validateScopeNamespaces(spec);)
const callNeedle = "validateScopeNamespaces(spec);";
if (!next.includes(callNeedle)) {
  console.error("ERROR: Could not find validateScopeNamespaces(spec); call in registerExecutor.");
  process.exit(1);
}

if (!next.includes("validateActionScopesSubset(spec);")) {
  next = next.replace(
    callNeedle,
    `${callNeedle}\n    validateActionScopesSubset(spec);`
  );
}

fs.writeFileSync(FILE, next);
console.log("Patched: domain_action_scopes subset enforced at registration gate.");
