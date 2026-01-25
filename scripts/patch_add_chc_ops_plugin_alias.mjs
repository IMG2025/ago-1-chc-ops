#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const pluginPath = path.join(ROOT, "packages", "sentinel-core", "src", "plugin.ts");

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

if (!fs.existsSync(pluginPath)) {
  throw new Error(`plugin.ts not found at ${pluginPath}`);
}

let src = fs.readFileSync(pluginPath, "utf8");

if (/export\s+const\s+mountCHCOpsPlugins\s*=/.test(src)) {
  console.log("OK: mountCHCOpsPlugins already present (no-op).");
  run("npm -w @chc/sentinel-core run build");
  run("npm run build");
  process.exit(0);
}

// 1) export function|const NAME
let name =
  (src.match(/export\s+function\s+([A-Za-z0-9_]+)\s*\(/) ?? [])[1] ??
  (src.match(/export\s+const\s+([A-Za-z0-9_]+)\s*=/) ?? [])[1];

// 2) function NAME ... then export { NAME }
if (!name) {
  const exportedBlock = (src.match(/export\s*{\s*([^}]+)\s*}/m) ?? [])[1];
  if (exportedBlock) {
    // pick first exported identifier (strip "as alias")
    const first = exportedBlock
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)[0];
    if (first) name = first.split(/\s+as\s+/)[0].trim();
  }
}

// 3) export default function NAME
if (!name) {
  name = (src.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)\s*\(/) ?? [])[1];
}

// 4) export default NAME;
if (!name) {
  name = (src.match(/export\s+default\s+([A-Za-z0-9_]+)\s*;/) ?? [])[1];
}

if (!name) {
  throw new Error(
    "Could not infer canonical mount symbol from plugin.ts. " +
    "Open packages/sentinel-core/src/plugin.ts and confirm exported API surface."
  );
}

// If the mount is default export, we need a stable identifier to alias.
// Create one only if needed.
const needsDefaultWrapper =
  /export\s+default/.test(src) &&
  !new RegExp(`\\b${name}\\b`).test(src.replace(/export\s+default/g, ""));

if (needsDefaultWrapper) {
  // Best effort: default export symbol isn't a named identifier we can reference
  throw new Error(
    "plugin.ts uses an anonymous default export; cannot alias safely without a named export."
  );
}

src = src.trimEnd() + `

/**
 * CHC Ops compatibility alias.
 * Do NOT remove — consumed by diagnostics and ops tooling.
 */
export const mountCHCOpsPlugins = ${name};
`;

fs.writeFileSync(pluginPath, src);
console.log(`Patched: added mountCHCOpsPlugins alias -> ${name}`);

run("npm -w @chc/sentinel-core run build");
run("npm run build");
