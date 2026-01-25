import fs from "node:fs";

const FILE = "src/registry.ts";
const src = fs.readFileSync(FILE, "utf8");

// idempotent guard
if (src.includes("SCOPE_NAMESPACE_GATE")) {
  console.log("OK: scope namespace gate already present (no-op).");
  process.exit(0);
}

/**
 * Anchor on the real supported-task gate as shown in your rg output:
 *   if (!spec.supported_task_types.includes(taskType)) {
 *     throw chOpsError("UNSUPPORTED_TASK_TYPE", { ... });
 *   }
 *
 * We insert immediately after that block.
 */
const rx =
  /(\n\s*if\s*\(\s*!\s*spec\.supported_task_types\.includes\(\s*taskType\s*\)\s*\)\s*\{\s*\n[\s\S]*?throw\s+chOpsError\(\s*["']UNSUPPORTED_TASK_TYPE["'][\s\S]*?\);\s*\n\s*\}\s*\n)/m;

const m = src.match(rx);
if (!m) {
  console.error("ERROR: Could not find authorize() supported_task_types gate block to anchor patch.");
  process.exit(1);
}

const gateBlock = m[1];

const insert = `${gateBlock}
  // SCOPE_NAMESPACE_GATE:
  // Sentinel-aligned: scope must be namespaced as <domain_id>:*
  if (typeof scope !== "string" || !scope.startsWith(domain_id + ":")) {
    throw chOpsError("INVALID_SCOPE_NAMESPACE", {
      domain_id,
      task_type: taskType,
      scope,
      note: "scope must be namespaced as <domain_id>:*",
    });
  }
`;

const next = src.replace(rx, insert);
fs.writeFileSync(FILE, next);
console.log("Patched: authorize() now enforces scope namespace.");
