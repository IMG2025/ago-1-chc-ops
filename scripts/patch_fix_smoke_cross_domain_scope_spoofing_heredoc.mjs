#!/usr/bin/env node
import fs from "node:fs";

const FILE = "scripts/smoke_cross_domain_scope_spoofing.sh";
let src = fs.readFileSync(FILE, "utf8");

// Idempotency: if the fixed anchor exists, no-op
if (src.includes("const ROOT = process.cwd();") && src.includes("await import(ROOT + \"/dist/registry.js\")")) {
  console.log("OK: smoke_cross_domain_scope_spoofing heredoc already fixed (no-op).");
  process.exit(0);
}

// Replace ANY node heredoc block in this file with a canonical, well-terminated one.
// This also fixes the delimiter issue (ensures the closing NODE appears on its own line).
const rx = /node\s+-\s+<<['"]?NODE['"]?[\s\S]*?\nNODE\s*/m;

const replacement = `node - <<'NODE'
const ROOT = process.cwd();

// ESM-safe, Termux-safe dynamic imports anchored to repo root
const { createRegistry } = await import(ROOT + "/dist/registry.js");
const { mountCHCOpsPlugins } = await import(ROOT + "/dist/index.js");

const registry = createRegistry();
mountCHCOpsPlugins(registry);

// Cross-domain spoof attempts must fail
try {
  registry.authorize("ciag", { type: "EXECUTE" }, "hospitality:execute");
  console.error("FAIL: ciag accepted hospitality scope");
  process.exit(1);
} catch (e) {
  console.log("OK: ciag EXECUTE with hospitality scope =>", e.code || e.message);
}

try {
  registry.authorize("hospitality", { type: "EXECUTE" }, "ciag:execute");
  console.error("FAIL: hospitality accepted ciag scope");
  process.exit(1);
} catch (e) {
  console.log("OK: hospitality EXECUTE with ciag scope =>", e.code || e.message);
}
NODE
`;

if (!rx.test(src)) {
  console.error("ERROR: Could not find node heredoc block to patch in scripts/smoke_cross_domain_scope_spoofing.sh");
  process.exit(1);
}

src = src.replace(rx, replacement);
fs.writeFileSync(FILE, src);
console.log("Patched: smoke_cross_domain_scope_spoofing heredoc fixed + ESM imports corrected.");
