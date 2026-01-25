#!/usr/bin/env node
import fs from "node:fs";

const FILE = "packages/sentinel-core/src/registry.ts";
if (!fs.existsSync(FILE)) throw new Error(`Missing: ${FILE}`);
const src = fs.readFileSync(FILE, "utf8");

function uniq(a) { return [...new Set(a)].sort(); }

const exportType = [...src.matchAll(/export\s+type\s+(\w+)/g)].map(m => m[1]);
const exportIface = [...src.matchAll(/export\s+interface\s+(\w+)/g)].map(m => m[1]);
const exportClass = [...src.matchAll(/export\s+class\s+(\w+)/g)].map(m => m[1]);
const exportFunc = [...src.matchAll(/export\s+function\s+(\w+)/g)].map(m => m[1]);
const exportConst = [...src.matchAll(/export\s+const\s+(\w+)/g)].map(m => m[1]);
const mentionsDomainRegistry = /DomainRegistry/.test(src);

console.log(JSON.stringify({
  file: FILE,
  mentionsDomainRegistry,
  exports: {
    types: uniq(exportType),
    interfaces: uniq(exportIface),
    classes: uniq(exportClass),
    functions: uniq(exportFunc),
    consts: uniq(exportConst),
  },
  first_80_lines: src.split("\n").slice(0, 80).join("\n"),
}, null, 2));
