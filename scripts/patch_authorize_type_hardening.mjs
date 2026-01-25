#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

/**
 * 1. Inject branded types (idempotent)
 */
if (!src.includes("type Brand<")) {
  src =
    `// --- type branding (authorize hardening) ---
type Brand<K, T> = K & { __brand: T };
type DomainId = Brand<string, "DomainId">;
type ScopeString = Brand<string, "ScopeString">;
type TaskTypeId = Brand<string, "TaskTypeId">;
// --- end branding ---
\n\n` + src;
}

/**
 * 2. Harden authorize() signature
 *    Must anchor AFTER taskType initialization
 */
const anchor = /const taskType = getTaskType\(task\);/;

if (!anchor.test(src)) {
  console.error("ERROR: authorize() taskType anchor not found.");
  process.exit(1);
}

const hardenedAuthorize = `
function authorize(
  domain_id: DomainId,
  task: unknown,
  scope: ScopeString
): void {
  const taskType = getTaskType(task);
`;

if (!src.includes("DomainId") || src.includes("task: any")) {
  src = src.replace(
    /authorize\s*\([\s\S]*?\)\s*:\s*void\s*{[\s\S]*?const taskType = getTaskType\(task\);/,
    hardenedAuthorize.trim()
  );
}

/**
 * 3. Write back
 */
fs.writeFileSync(FILE, src);
console.log("Patched: authorize() type hardening applied.");

/**
 * 4. Final gate
 */
import { execSync } from "node:child_process";
execSync("npm run build", { stdio: "inherit" });
