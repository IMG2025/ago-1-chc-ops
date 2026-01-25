import { DomainRegistry } from "../dist/registry.js";
import { registerHospitality } from "../dist/plugin.js";

const registry = new DomainRegistry();

// This is the canonical mount pattern
registerHospitality((spec) => registry.registerExecutor(spec));

const domains = registry.listDomains();
console.log("Mounted domains:", domains);

if (!domains.includes("hospitality")) {
  throw new Error("Smoke failed: hospitality domain not registered");
}

console.log("Plugin registration pattern OK");
