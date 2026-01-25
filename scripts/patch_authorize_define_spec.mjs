#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

// If authorize already defines spec, we no-op.
if (/\bauthorize\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?\bconst\s+spec\s*=/.test(src)) {
  console.log("OK: authorize() already defines spec (no-op).");
  execSync("npm run build", { stdio: "inherit" });
  process.exit(0);
}

// Detect the backing map name from registerExecutor: this.<map>.set(spec.domain_id, spec)
const m = src.match(/this\.(\w+)\.set\s*\(\s*spec\.domain_id\s*,\s*spec\s*\)/);
if (!m) {
  console.error("ERROR: Could not detect registry map name (expected this.<map>.set(spec.domain_id, spec)).");
  process.exit(1);
}
const mapName = m[1];

// Anchor: first use of validateScopeNamespaces(spec);
const needle = "validateScopeNamespaces(spec);";
if (!src.includes(needle)) {
  console.error(`ERROR: Anchor not found: ${needle}`);
  process.exit(1);
}

// If spec is referenced, but not declared, insert declaration + guard immediately before first usage.
const insert =
  `const spec = this.${mapName}.get(domain_id);\n` +
  `    if (!spec) {\n` +
  `      throw chcOpsError("UNKNOWN_DOMAIN", { domain_id });\n` +
  `    }\n\n    `;

src = src.replace(needle, insert + needle);

fs.writeFileSync(FILE, src);
console.log(`Patched: authorize() now defines spec via this.${mapName}.get(domain_id) with UNKNOWN_DOMAIN guard.`);

// Final gate
execSync("npm run build", { stdio: "inherit" });
