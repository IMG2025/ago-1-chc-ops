#!/usr/bin/env node
/**
 * DEPRECATED/BROKEN: v1 included escaped backticks which break JS parsing.
 * Use scripts/patch_step_17_lock_registry_contract_v2.mjs instead.
 */
import { execSync } from "node:child_process";
execSync("npm test", { stdio: "inherit" });
execSync("npm run build", { stdio: "inherit" });
