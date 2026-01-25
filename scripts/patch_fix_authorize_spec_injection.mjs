#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

// Detect backing map name from registerExecutor: this.<map>.set(spec.domain_id, spec)
const m = src.match(/this\.(\w+)\.set\s*\(\s*spec\.domain_id\s*,\s*spec\s*\)/);
if (!m) {
  console.error("ERROR: Could not detect registry map name (expected this.<map>.set(spec.domain_id, spec)).");
  process.exit(1);
}
const mapName = m[1];

// 1) Remove the bad injection inside registerExecutor (duplicate 'spec' + domain_id use)
const badRegisterInjection = new RegExp(
  String.raw`(\bregisterExecutor\s*\(\s*spec\s*:\s*ExecutorSpec\s*\)\s*:\s*void\s*\{\s*\n)([ \t]*)const spec = this\.${mapName}\.get\(domain_id\);\s*\n([\s\S]*?\n\2\})\s*\n`,
  "m"
);

if (badRegisterInjection.test(src)) {
  src = src.replace(badRegisterInjection, "$1");
  console.log("Patched: removed erroneous spec lookup injected into registerExecutor().");
} else {
  console.log("OK: no erroneous registerExecutor() injection found (no-op).");
}

// 2) Ensure authorize() defines spec (in the correct scope) before first validateScopeNamespaces(spec);
const authIdx = src.search(/\bauthorize\s*\(/);
if (authIdx === -1) {
  console.error("ERROR: Could not find authorize(...) in src/registry.ts");
  process.exit(1);
}

const before = src.slice(0, authIdx);
let after = src.slice(authIdx);

// If authorize already defines spec, no-op
if (/\bauthorize\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?\bconst\s+spec\s*=/.test(after)) {
  console.log("OK: authorize() already defines spec (no-op).");
} else {
  const needle = "validateScopeNamespaces(spec);";
  const pos = after.indexOf(needle);
  if (pos === -1) {
    console.error(`ERROR: Could not find anchor inside authorize(): ${needle}`);
    process.exit(1);
  }

  const insert =
    `const spec = this.${mapName}.get(domain_id);\n` +
    `    if (!spec) {\n` +
    `      throw chcOpsError("UNKNOWN_DOMAIN", { domain_id });\n` +
    `    }\n\n    `;

  after = after.replace(needle, insert + needle);
  console.log(`Patched: authorize() now defines spec via this.${mapName}.get(domain_id) with UNKNOWN_DOMAIN guard.`);
}

fs.writeFileSync(FILE, before + after);

// Final gate
execSync("npm run build", { stdio: "inherit" });
