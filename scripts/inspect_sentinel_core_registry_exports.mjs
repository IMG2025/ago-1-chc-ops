#!/usr/bin/env node
import fs from "node:fs";

const INDEX = "packages/sentinel-core/src/index.ts";
const DIR = "packages/sentinel-core/src";

const idx = fs.readFileSync(INDEX, "utf8");

console.log("=== index.ts exports (top 60 lines) ===");
console.log(idx.split("\n").slice(0, 60).join("\n"));

function scanFile(file) {
  const src = fs.readFileSync(file, "utf8");
  const hits = [];
  const patterns = [
    /export\s+type\s+(\w*Registry\w*)/g,
    /export\s+interface\s+(\w*Registry\w*)/g,
    /export\s+class\s+(\w*Registry\w*)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(src))) hits.push(m[1]);
  }
  return hits;
}

const files = fs.readdirSync(DIR)
  .filter(f => f.endsWith(".ts"))
  .map(f => `${DIR}/${f}`);

let registryCandidates = new Set();
let exportCandidates = new Set();

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  if (/registerExecutor/.test(src) || /Registry/.test(src)) {
    // crude scan
    const hits = scanFile(f);
    hits.forEach(h => exportCandidates.add(h));
    // special: registry-ish names
    const regHits = (src.match(/\b\w*Registry\w*\b/g) || []);
    regHits.forEach(h => registryCandidates.add(h));
  }
}

console.log("\n=== candidates containing 'Registry' in sentinel-core/*.ts ===");
console.log(Array.from(registryCandidates).sort().slice(0, 80).join("\n") || "(none)");

console.log("\n=== exported symbols found in sentinel-core/*.ts (sample) ===");
console.log(Array.from(exportCandidates).sort().slice(0, 120).join("\n") || "(none)");

console.log("\n=== lines mentioning registerExecutor (first 50 matches) ===");
let count = 0;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("registerExecutor")) {
      console.log(`${f}:${i+1}: ${lines[i]}`);
      if (++count >= 50) process.exit(0);
    }
  }
}
