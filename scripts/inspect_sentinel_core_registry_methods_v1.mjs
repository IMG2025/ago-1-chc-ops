#!/usr/bin/env node
import fs from "node:fs";

const FILE = "packages/sentinel-core/src/registry.ts";
if (!fs.existsSync(FILE)) throw new Error(`Missing: ${FILE}`);
const src = fs.readFileSync(FILE, "utf8");

function block(re) {
  const m = src.match(re);
  return m ? m[1] : "";
}

const classBody =
  block(/export\s+class\s+DomainRegistry\s*\{([\s\S]*?)\n\}/m) ||
  block(/class\s+DomainRegistry\s*\{([\s\S]*?)\n\}/m);

const ifaceBody =
  block(/export\s+interface\s+ExecutorRegistry\s*\{([\s\S]*?)\n\}/m) ||
  block(/interface\s+ExecutorRegistry\s*\{([\s\S]*?)\n\}/m);

function methodsFrom(body) {
  const out = [];
  for (const m of body.matchAll(/^\s*(\w+)\s*\(([^)]*)\)\s*[:{]/gm)) {
    const name = m[1];
    if (name === "constructor") continue;
    const params = m[2].trim();
    const arity = params ? params.split(",").map(s => s.trim()).filter(Boolean).length : 0;
    out.push({ name, params, arity });
  }
  return out;
}

console.log(JSON.stringify({
  file: FILE,
  domainRegistry_methods: methodsFrom(classBody),
  executorRegistry_methods: methodsFrom(ifaceBody),
}, null, 2));
