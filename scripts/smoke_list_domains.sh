#!/usr/bin/env bash
set -euo pipefail

npm run build

node - <<'NODE'
import { DomainRegistry } from "./dist/registry.js";
import { mountCHCOpsPlugins } from "./dist/index.js";

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

const domains = registry.listDomains();
console.log("Mounted domains:", domains);

if (!domains.includes("ciag") || !domains.includes("hospitality")) {
  throw new Error("Smoke failed: expected ciag + hospitality");
}
NODE
