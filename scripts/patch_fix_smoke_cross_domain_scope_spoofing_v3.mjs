#!/usr/bin/env node
import fs from "node:fs";

const FILE = "scripts/smoke_cross_domain_scope_spoofing.sh";
let src = fs.readFileSync(FILE, "utf8");

// Idempotency check
if (src.includes("const ROOT = process.cwd();") &&
    src.includes("Cross-domain spoof attempts must fail")) {
  console.log("OK: cross-domain smoke already canonical (no-op).");
  process.exit(0);
}

// Match heredoc block
const rx = /node[\s\S]*?<<['"]?NODE['"]?[\s\S]*?\nNODE\b[\s\S]*?;/m;

if (!rx.test(src)) {
  console.error("ERROR: NODE heredoc block not found in smoke script.");
  process.exit(1);
}

const replacement = `node - <<'NODE'
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const registryPath = pathToFileURL(path.join(ROOT, "dist/registry.js")).href;
const indexPath = pathToFileURL(path.join(ROOT, "dist/index.js")).href;

const { createRegistry } = await import(registryPath);
const { mountCHCOpsPlugins } = await import(indexPath);

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
;`;

src = src.replace(rx, replacement);
fs.writeFileSync(FILE, src);

console.log("Patched: cross-domain smoke now uses pure JS path resolution.");
