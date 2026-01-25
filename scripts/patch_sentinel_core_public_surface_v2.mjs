#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const REGISTRY = path.join(ROOT, "packages/sentinel-core/src/registry.ts");
const PLUGIN = path.join(ROOT, "packages/sentinel-core/src/plugin.ts");
const INDEX = path.join(ROOT, "packages/sentinel-core/src/index.ts");

for (const f of [REGISTRY, PLUGIN, INDEX]) {
  if (!fs.existsSync(f)) throw new Error(`Missing file: ${f}`);
}

const MARK = "/* @chc/sentinel-core public-surface v2 */\n";

const registrySrc = fs.readFileSync(REGISTRY, "utf8");

// Detect registry.register arity from source text (supports interface/type/class patterns).
// If we see "register(domain" assume 2-arg signature; otherwise 1-arg.
const registerTakesDomain =
  /\bregister\s*\(\s*domain\s*:\s*string\b/.test(registrySrc) ||
  /\bregister\s*\(\s*domain\s*:\s*["']/.test(registrySrc) ||
  /\bregister\s*\(\s*domain\b/.test(registrySrc);

const pluginDesired =
`${MARK}import type { DomainRegistry } from "./registry.js";
import { hospitalityExecutorSpec } from "./executors.js";

/**
 * Mount all CHC Ops plugins into the provided registry.
 * This is the canonical entrypoint used by sentinel-core diagnostics and by CHC ops runtime mounting.
 */
export function mountCHCOpsPlugins(registry: DomainRegistry): void {
  ${registerTakesDomain
    ? `registry.register("hospitality", hospitalityExecutorSpec);`
    : `registry.register(hospitalityExecutorSpec);`}
}

/**
 * Back-compat alias (older callers may use "mount").
 */
export function mount(registry: DomainRegistry): void {
  return mountCHCOpsPlugins(registry);
}
`;

let pluginNow = fs.readFileSync(PLUGIN, "utf8");
if (pluginNow !== pluginDesired) {
  fs.writeFileSync(PLUGIN, pluginDesired);
}

let indexNow = fs.readFileSync(INDEX, "utf8");

// Canonical minimal barrel: remove exports that cause TS2308 collisions,
// then export only stable surface + derived type.
const idxLines = indexNow.split("\n");

// Remove any export-star lines from contracts barrels that can collide.
const filtered = idxLines.filter((line) => {
  const t = line.trim();
  if (/^export\s+\*\s+from\s+["']\.\/contracts\/index\.js["']\s*;?$/.test(t)) return false;
  if (/^export\s+\*\s+from\s+["']\.\/errors\.js["']\s*;?$/.test(t)) return false;
  if (/^export\s+\*\s+from\s+["']\.\/registry\.js["']\s*;?$/.test(t)) return false;
  if (/^export\s+\*\s+from\s+["']\.\/plugin\.js["']\s*;?$/.test(t)) return false;
  return true;
});

let nextIdx = filtered.join("\n").trimEnd() + "\n\n";

// Ensure marker + canonical exports appear exactly once.
const canonicalBlock =
`${MARK}export type { DomainRegistry } from "./registry.js";
export { mountCHCOpsPlugins, mount } from "./plugin.js";

/**
 * Canonical executor registration function type.
 * Derived from DomainRegistry.register to avoid drift.
 */
export type RegisterExecutorFn = DomainRegistry["register"];
`;

nextIdx = nextIdx.replace(new RegExp(`${MARK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*$`, "m"), "");
nextIdx = nextIdx.trimEnd() + "\n\n" + canonicalBlock;

if (indexNow !== nextIdx) {
  fs.writeFileSync(INDEX, nextIdx);
}

console.log("OK: sentinel-core public surface v2 ensured (mountCHCOpsPlugins + RegisterExecutorFn, no collision exports).");

// Gates
run("npm -w @chc/sentinel-core run build");
run("npm test");
run("npm run build");
