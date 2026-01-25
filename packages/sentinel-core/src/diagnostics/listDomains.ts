import { DomainRegistry } from "../registry.js";
import { mountCHCOpsPlugins } from "../plugin.js";

const registry = new DomainRegistry();
mountCHCOpsPlugins(registry);

console.log("Mounted domains:", registry.listDomains());
