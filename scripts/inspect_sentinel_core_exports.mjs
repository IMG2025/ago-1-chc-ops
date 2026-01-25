#!/usr/bin/env node
import fs from "node:fs";

const idx = "packages/sentinel-core/src/index.ts";
const plugin = "packages/sentinel-core/src/plugin.ts";

const s1 = fs.readFileSync(idx, "utf8");
const s2 = fs.readFileSync(plugin, "utf8");

function has(re, src) { return (src.match(re) || []).length; }

console.log(JSON.stringify({
  index_has_RegisterExecutorFn: has(/RegisterExecutorFn/g, s1),
  index_exports_registerExecutor: has(/export\s*\{\s*registerExecutor\s*\}/g, s1),
  plugin_has_registerExecutor_fn: has(/export\s+function\s+registerExecutor\s*\(/g, s2),
  plugin_mentions_registerExecutor: has(/registerExecutor/g, s2),
}, null, 2));
