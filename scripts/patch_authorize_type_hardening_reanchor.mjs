#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const FILE = "src/registry.ts";
let src = fs.readFileSync(FILE, "utf8");

/**
 * Ensure branded types exist (idempotent)
 */
if (!src.includes("type Brand<")) {
  src =
`// --- type branding (authorize hardening) ---
type Brand<K, T> = K & { __brand: T };
type DomainId = Brand<string, "DomainId">;
type ScopeString = Brand<string, "ScopeString">;
// --- end branding ---

` + src;
}

/**
 * Harden authorize() method signature IN-PLACE
 */
const before =
/authorize\s*\(\s*domain_id:\s*string\s*,\s*task:\s*any\s*,\s*scope:\s*string\s*\)\s*:\s*void\s*\{/;

const after =
`authorize(domain_id: DomainId, task: unknown, scope: ScopeString): void {`;

if (!before.test(src)) {
  console.log("OK: authorize() already type-hardened (no-op).");
} else {
  src = src.replace(before, after);
  console.log("Patched: authorize() signature type hardened.");
}

fs.writeFileSync(FILE, src);

/**
 * Final gate
 */
execSync("npm run build", { stdio: "inherit" });
