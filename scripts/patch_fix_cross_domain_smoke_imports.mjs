#!/usr/bin/env node
import fs from "node:fs";

const FILE = "scripts/smoke_cross_domain_scope_spoofing.sh";
let src = fs.readFileSync(FILE, "utf8");

if (src.includes("process.cwd()")) {
  console.log("OK: cross-domain smoke already uses cwd-anchored imports (no-op).");
  process.exit(0);
}

src = src.replace(
  /import\s+\{\s*createRegistry\s*\}.*\nimport\s+\{\s*mountCHCOpsPlugins\s*\}.*\n/s,
  `import { createRegistry } from \`\${process.cwd()}/dist/registry.js\`;
import { mountCHCOpsPlugins } from \`\${process.cwd()}/dist/index.js\`;
`
);

fs.writeFileSync(FILE, src);
console.log("Patched: cross-domain smoke imports anchored to repo root.");
