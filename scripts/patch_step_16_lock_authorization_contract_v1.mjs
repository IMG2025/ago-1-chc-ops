#!/usr/bin/env node
/**
 * DEPRECATED/BROKEN: v1 embedded bash "${...}" which breaks JS template literals.
 * Use scripts/patch_step_16_lock_authorization_contract_v2.mjs instead.
 */
import { execSync } from "node:child_process";
execSync("npm test", { stdio: "inherit" });
execSync("npm run build", { stdio: "inherit" });
