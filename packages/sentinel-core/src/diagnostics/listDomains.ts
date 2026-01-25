import { DomainRegistry } from "../registry.js";
import { mountCHCOpsPlugins } from "../plugin.js";

const registry = new DomainRegistry();
mountCHCOpsPlugins((spec) => registry.registerExecutor(spec));

console.log("Mounted domains:", registry.listDomains());
