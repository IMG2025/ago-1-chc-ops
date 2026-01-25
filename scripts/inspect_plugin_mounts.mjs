#!/usr/bin/env node
import fs from "node:fs";

const file = "src/plugin.ts";
const src = fs.readFileSync(file, "utf8");

function count(re) {
  return (src.match(re) || []).length;
}

const report = {
  has_export_fn_mountCHC: count(/export\s+function\s+mountCHCOpsPlugins\s*\(/g),
  has_fn_mountCHC: count(/function\s+mountCHCOpsPlugins\s*\(/g),
  has_export_const_mountCHC: count(/export\s+const\s+mountCHCOpsPlugins\s*=/g),
  has_const_mountCHC: count(/const\s+mountCHCOpsPlugins\s*=/g),
  has_export_named: count(/export\s*\{\s*mountCHCOpsPlugins\s*\}/g),
  has_registerHospitality: count(/registerHospitality/g),
  has_registerCIAG: count(/registerCIAG/g),
  has_registerExecutors: count(/registerExecutor/g),
  has_exported_mount_like: (src.match(/export\s+(function|const)\s+mount\w+/g) || []).slice(0, 20),
};

console.log(JSON.stringify(report, null, 2));

console.log("\n--- plugin.ts mount-related lines ---");
const lines = src.split("\n");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (
    /mountCHCOpsPlugins|mount\w+|registerHospitality|registerCIAG|registerExecutor/.test(l)
  ) {
    const n = String(i + 1).padStart(4, " ");
    console.log(`${n}: ${l}`);
  }
}
