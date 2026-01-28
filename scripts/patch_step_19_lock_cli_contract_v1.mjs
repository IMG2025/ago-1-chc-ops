#!/usr/bin/env node
/**
 * DEPRECATED/BROKEN: v1 embedded Bash ${...} inside a JS template literal (backticks), which breaks JS parsing.
 * Use scripts/patch_step_19_lock_cli_contract_v2.mjs instead.
 */
import { execSync } from "node:child_process";
execSync("npm test", { stdio: "inherit" });
execSync("npm run build", { stdio: "inherit" });
