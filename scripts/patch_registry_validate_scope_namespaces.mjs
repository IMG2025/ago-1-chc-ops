#!/usr/bin/env node
import fs from "node:fs";

const FILE = "src/registry.ts";

if (!fs.existsSync(FILE)) {
  console.error("ERROR: src/registry.ts not found");
  process.exit(1);
}

const src = fs.readFileSync(FILE, "utf8");

// No-op if already enforced
if (src.includes("validateScopeNamespaces(spec);")) {
  console.log("OK: validateScopeNamespaces already enforced (no-op)");
} else {
  const rx = /(registerExecutor\s*\(\s*spec:\s*ExecutorSpec\s*\)\s*:\s*void\s*\{)/;

  if (!rx.test(src)) {
    console.error("ERROR: registerExecutor signature not found");
    process.exit(1);
  }

  const next = src.replace(
    rx,
    `$1\n    validateScopeNamespaces(spec);`
  );

  fs.writeFileSync(FILE, next);
  console.log("Patched: validateScopeNamespaces enforced at registration");
}

process.exit(0);
