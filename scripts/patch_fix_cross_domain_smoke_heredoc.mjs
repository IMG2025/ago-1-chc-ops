#!/usr/bin/env node
import fs from "node:fs";

const FILE = "scripts/smoke_cross_domain_scope_spoofing.sh";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("const ROOT = process.cwd()")) {
  console.log("OK: cross-domain smoke heredoc already fixed (no-op).");
  process.exit(0);
}

src = src.replace(
  /node\s+-\s+<<'NODE'[\s\S]*?NODE/g,
  `node - <<'NODE'
const ROOT = process.cwd();

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
  console.log("OK: ciag EXECUTE with hospitality scope =>", e.code);
}

try {
  registry.authorize("hospitality", { type: "EXECUTE" }, "ciag:execute");
  console.error("FAIL: hospitality accepted ciag scope");
  process.exit(1);
} catch (e) {
  console.log("OK: hospitality EXECUTE with ciag scope =>", e.code);
}
NODE`
);

fs.writeFileSync(FILE, src);
console.log("Patched: cross-domain smoke heredoc uses runtime-rooted dynamic imports.");
