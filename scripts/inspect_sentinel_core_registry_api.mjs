#!/usr/bin/env node
import fs from "node:fs";

const FILE = "packages/sentinel-core/src/registry.ts";
if (!fs.existsSync(FILE)) throw new Error(`Missing: ${FILE}`);
const src = fs.readFileSync(FILE, "utf8");

// Try to extract DomainRegistry body (interface or type literal)
let body = "";
const iface = src.match(/interface\s+DomainRegistry\s*\{([\s\S]*?)\}/m);
if (iface) body = iface[1];

if (!body) {
  const typeLit = src.match(/type\s+DomainRegistry\s*=\s*\{([\s\S]*?)\}\s*;/m);
  if (typeLit) body = typeLit[1];
}

if (!body) {
  console.log(JSON.stringify({ ok: false, reason: "Could not locate DomainRegistry interface/type literal" }, null, 2));
  process.exit(0);
}

// Find first method signature inside DomainRegistry
const m = body.match(/^\s*(\w+)\s*\(([^)]*)\)\s*:\s*[^;]+;/m);
if (!m) {
  console.log(JSON.stringify({ ok: false, reason: "Found DomainRegistry body, but no method signature matched" }, null, 2));
  process.exit(0);
}

const method = m[1];
const params = m[2].trim();
const arity = params ? params.split(",").length : 0;

console.log(JSON.stringify({ ok: true, method, params, arity }, null, 2));
