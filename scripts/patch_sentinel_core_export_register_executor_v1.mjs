#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const PLUGIN = "packages/sentinel-core/src/plugin.ts";
const INDEX  = "packages/sentinel-core/src/index.ts";

let pluginSrc = fs.readFileSync(PLUGIN, "utf8");

// Ensure registerExecutor exists
if (!pluginSrc.includes("registerExecutor")) {
  throw new Error("Invariant violated: registerExecutor not found in plugin.ts");
}

// Ensure it is exported
if (!pluginSrc.match(/export\s+(function|const)\s+registerExecutor/)) {
  pluginSrc = pluginSrc.replace(
    /(function\s+registerExecutor|\bconst\s+registerExecutor)/,
    "export $1"
  );
  fs.writeFileSync(PLUGIN, pluginSrc);
  console.log("Patched: registerExecutor exported from plugin.ts");
} else {
  console.log("OK: registerExecutor already exported.");
}

// Ensure index.ts re-exports it
let indexSrc = fs.readFileSync(INDEX, "utf8");

if (!indexSrc.includes("registerExecutor")) {
  indexSrc =
    indexSrc.trimEnd() +
    `\nexport { registerExecutor } from "./plugin.js";\n`;
  fs.writeFileSync(INDEX, indexSrc);
  console.log("Patched: registerExecutor re-exported from index.ts");
} else {
  console.log("OK: registerExecutor already re-exported.");
}

run("npm test");
run("npm run build");
