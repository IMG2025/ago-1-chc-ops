#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const FILE = "packages/sentinel-core/src/plugin.ts";
if (!fs.existsSync(FILE)) throw new Error(`Missing: ${FILE}`);

let src = fs.readFileSync(FILE, "utf8");

// ---------- Helpers ----------
function has(re) {
  return re.test(src);
}

// Find a "canonical mount" function we can alias to.
// Prefer an exported mount-like function that takes a DomainRegistry-ish param.
function findMountSymbol() {
  // 1) Any exported function named mount* (excluding mountCHCOpsPlugins itself)
  const m1 = src.match(/export\s+function\s+(mount(?!CHCOpsPlugins)\w*)\s*\(([^)]*)\)/);
  if (m1) return m1[1];

  // 2) A non-exported function mountCHCOpsPlugins exists (we'll just export it later)
  if (src.match(/function\s+mountCHCOpsPlugins\s*\(/)) return "mountCHCOpsPlugins";

  // 3) Any exported function that looks like a mount and takes "registry"
  const m2 = src.match(/export\s+function\s+(\w*mount\w*)\s*\(([^)]*registry[^)]*)\)/i);
  if (m2 && m2[1] !== "mountCHCOpsPlugins") return m2[1];

  return null;
}

// Find a register function we can alias to.
function findRegisterSymbol() {
  // 1) exported function registerExecutor
  if (src.match(/export\s+function\s+registerExecutor\s*\(/)) return "registerExecutor";

  // 2) non-exported function registerExecutor (we'll export it)
  if (src.match(/\bfunction\s+registerExecutor\s*\(/)) return "registerExecutor";

  // 3) exported function register(...)
  const m1 = src.match(/export\s+function\s+(register)\s*\(/);
  if (m1) return m1[1];

  // 4) exported const register = ...
  const m2 = src.match(/export\s+const\s+(register)\s*=/);
  if (m2) return m2[1];

  return null;
}

// ---------- A) Ensure registerExecutor is exported ----------
const regSym = findRegisterSymbol();
if (!regSym) {
  throw new Error("Invariant violated: could not locate any register-like function to backfill registerExecutor.");
}

if (regSym === "registerExecutor") {
  // If registerExecutor exists but is not exported, export it.
  if (has(/\bfunction\s+registerExecutor\s*\(/) && !has(/export\s+function\s+registerExecutor\s*\(/)) {
    src = src.replace(/\bfunction\s+registerExecutor\s*\(/, "export function registerExecutor(");
  }
} else {
  // Create exported alias only if missing
  if (!has(/export\s+(const|function)\s+registerExecutor\b/)) {
    src = src.trimEnd() + `

/**
 * Back-compat: canonical executor registration entrypoint.
 * Delegates to existing ${regSym} implementation.
 */
export const registerExecutor = ${regSym};
`;
  }
}

// ---------- B) Ensure mountCHCOpsPlugins is exported ----------
const mountSym = findMountSymbol();
if (!mountSym) {
  throw new Error("Invariant violated: could not locate any mount-like function to backfill mountCHCOpsPlugins.");
}

if (mountSym === "mountCHCOpsPlugins") {
  // If mountCHCOpsPlugins exists but is not exported, export it.
  if (has(/\bfunction\s+mountCHCOpsPlugins\s*\(/) && !has(/export\s+function\s+mountCHCOpsPlugins\s*\(/)) {
    src = src.replace(/\bfunction\s+mountCHCOpsPlugins\s*\(/, "export function mountCHCOpsPlugins(");
  }
} else {
  // Create exported wrapper only if missing
  if (!has(/export\s+(const|function)\s+mountCHCOpsPlugins\b/)) {
    src = src.trimEnd() + `

/**
 * Back-compat: legacy mount entrypoint used by diagnostics.
 * Delegates to existing ${mountSym} implementation.
 */
export function mountCHCOpsPlugins(registry) {
  return ${mountSym}(registry);
}
`;
  }
}

// ---------- Write + gates ----------
fs.writeFileSync(FILE, src.trimEnd() + "\n");

console.log("OK: sentinel-core plugin compat exports ensured (registerExecutor + mountCHCOpsPlugins).");

run("npm -w @chc/sentinel-core run build");
run("npm run build");
