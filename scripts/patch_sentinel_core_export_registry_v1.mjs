#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}

const ROOT = process.cwd();
const CORE_DIR = path.join(ROOT, "packages/sentinel-core/src");
const INDEX = path.join(CORE_DIR, "index.ts");

const files = fs.readdirSync(CORE_DIR).filter(f => f.endsWith(".ts"));
let registryFile = null;

for (const f of files) {
  const p = path.join(CORE_DIR, f);
  const src = fs.readFileSync(p, "utf8");
  if (src.includes("registerExecutor")) {
    registryFile = f;
    break;
  }
}

if (!registryFile) {
  throw new Error("Could not locate sentinel-core file containing 'registerExecutor'.");
}

const registryPath = `./${registryFile.replace(/\.ts$/, ".js")}`;
const regSrc = fs.readFileSync(path.join(CORE_DIR, registryFile), "utf8");

// Find an exported Registry symbol in that file
const regDecl =
  regSrc.match(/export\s+(type|interface|class)\s+(\w*Registry\w*)\b/) ||
  regSrc.match(/export\s+(type|interface|class)\s+(\w+)\b[\s\S]{0,500}registerExecutor/);

if (!regDecl) {
  throw new Error(
    `Found registerExecutor in ${registryFile} but could not locate an exported Registry declaration.`
  );
}

const REG_NAME = regDecl[2];

let idx = fs.readFileSync(INDEX, "utf8");

// Idempotency: already exported?
const already =
  new RegExp(`export\\s+type\\s+\\{[^}]*\\b${REG_NAME}\\b[^}]*\\}\\s+from\\s+["']${registryPath}["']\\s*;`).test(idx) ||
  new RegExp(`export\\s+\\{[^}]*\\b${REG_NAME}\\b[^}]*\\}\\s+from\\s+["']${registryPath}["']\\s*;`).test(idx);

if (already) {
  console.log(`OK: ${REG_NAME} already exported from sentinel-core index.ts.`);
  run("npm run build");
  process.exit(0);
}

// Append export (safe)
idx = idx.trimEnd() + `\n\n// Public registry surface\nexport type { ${REG_NAME} } from "${registryPath}";\n`;

fs.writeFileSync(INDEX, idx);
console.log(`Patched: exported ${REG_NAME} from sentinel-core public surface (index.ts).`);

run("npm run build");
