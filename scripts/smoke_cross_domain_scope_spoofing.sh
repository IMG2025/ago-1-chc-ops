#!/usr/bin/env bash
set -euo pipefail

npm run build >/dev/null

node <<'NODE'
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const registryPath = pathToFileURL(path.join(ROOT, "dist/registry.js")).href;
const indexPath = pathToFileURL(path.join(ROOT, "dist/index.js")).href;

const { createRegistry } = await import(registryPath);
const { mountCHCOpsPlugins } = await import(indexPath);

const registry = createRegistry();
mountCHCOpsPlugins(registry);

// CIAG must not use hospitality scopes
try {
  registry.authorize("ciag", { type: "EXECUTE" }, "hospitality:execute");
  console.error("FAIL: ciag accepted hospitality scope");
  process.exit(1);
} catch (e) {
  console.log("OK: ciag EXECUTE with hospitality scope =>", e.code || e.message);
}

// Hospitality must not use CIAG scopes
try {
  registry.authorize("hospitality", { type: "EXECUTE" }, "ciag:execute");
  console.error("FAIL: hospitality accepted ciag scope");
  process.exit(1);
} catch (e) {
  console.log("OK: hospitality EXECUTE with ciag scope =>", e.code || e.message);
}
NODE
