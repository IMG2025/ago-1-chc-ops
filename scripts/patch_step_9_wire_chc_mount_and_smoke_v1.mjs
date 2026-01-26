#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function exists(p) { return fs.existsSync(p); }
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const chcSpec = "domains/chc.domain.json";
if (!exists(chcSpec)) throw new Error(`Missing: ${chcSpec} (Step 9 spec must exist)`);

// 1) Add CHC authorize smoke (idempotent)
const smoke = "scripts/smoke_authorize_chc.sh";
const smokeSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

node -e 'import("./dist/index.js").then(async (m)=>{ const { authorize } = m; const base = { domain_id:"chc", actor:{ subject_id:"u1", role:"operator" } }; const ok1 = authorize({ ...base, task_type:"EXECUTE", requested_scope:["chc:execute"] }); if (ok1.decision!=="ALLOW") throw new Error("expected ALLOW"); const ok2 = authorize({ ...base, task_type:"ANALYZE", requested_scope:["chc:read"] }); if (ok2.decision!=="ALLOW") throw new Error("expected ALLOW"); const ok3 = authorize({ ...base, task_type:"ESCALATE", requested_scope:["chc:escalate"] }); if (ok3.decision!=="ALLOW") throw new Error("expected ALLOW"); const bad = authorize({ ...base, task_type:"EXECUTE", requested_scope:["hospitality:execute"] }); if (bad.decision!=="DENY") throw new Error("expected DENY"); console.log("OK: authorize chc EXECUTE/ANALYZE/ESCALATE + cross-namespace deny"); }).catch(e=>{ console.error(e); process.exit(1); });'
`;
writeIfChanged(smoke, smokeSrc);
fs.chmodSync(smoke, 0o755);

// 2) Wire smoke into npm test chain (idempotent)
const pkgPath = "package.json";
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));
const testCmd = pkg.scripts?.test;
if (typeof testCmd !== "string") throw new Error("Invariant: package.json scripts.test missing or not a string.");

if (!testCmd.includes("smoke_authorize_chc.sh")) {
  let nextTest = testCmd;
  if (testCmd.includes("smoke_authorize_hospitality.sh")) {
    nextTest = testCmd.replace(
      "./scripts/smoke_authorize_hospitality.sh",
      "./scripts/smoke_authorize_hospitality.sh && ./scripts/smoke_authorize_chc.sh"
    );
  } else {
    nextTest = testCmd + " && ./scripts/smoke_authorize_chc.sh";
  }
  pkg.scripts.test = nextTest;
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

// 3) Auto-discover the real mount registry and inject CHC
// We locate the file that prints “Mounted domains:” (seen in your test output).
function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const srcRoot = "src";
if (!exists(srcRoot)) throw new Error("Missing: src/");

const tsFiles = listFiles(srcRoot).filter(p => p.endsWith(".ts"));
const candidates = tsFiles.filter(p => {
  const t = read(p);
  return t.includes("Mounted domains") || (t.includes("ciag") && t.includes("hospitality"));
});

if (candidates.length === 0) {
  throw new Error(
    "Invariant: could not locate mount registry. No src/*.ts file contained 'Mounted domains' or both 'ciag' and 'hospitality'.\n" +
    "Run: rg -n \"Mounted domains|ciag|hospitality\" src | head -n 80"
  );
}

// Prefer the file that includes the log line.
let mountFile = candidates.find(p => read(p).includes("Mounted domains")) ?? candidates[0];

let mountSrc = read(mountFile);
if (mountSrc.includes("'chc'") || mountSrc.includes('"chc"') || mountSrc.includes("chc.domain.json")) {
  // already wired somewhere in this file
} else {
  // Strategy A: literal array ['ciag', 'hospitality'] -> add 'chc'
  const a = /\[\s*['"]ciag['"]\s*,\s*['"]hospitality['"]\s*\]/m;
  if (a.test(mountSrc)) {
    mountSrc = mountSrc.replace(a, `['ciag','hospitality','chc']`);
  } else {
    // Strategy B: object map keys ciag/hospitality -> add chc key by mirroring pattern
    // Example: { ciag: ..., hospitality: ... }
    const obj = /(\{\s*[\s\S]*?\bciag\b[\s\S]*?\bhospitality\b[\s\S]*?\})/m;
    const m = mountSrc.match(obj);
    if (!m) {
      throw new Error(
        `Invariant: found candidate mount file (${mountFile}) but could not match a mount list/map to inject 'chc'.\n` +
        `Run: sed -n '1,220p' ${mountFile}`
      );
    }

    // Conservative: inject a string 'chc' into the first array in the file that already contains both domains.
    const looseArray = /\[\s*([^\]]*['"]ciag['"][^\]]*['"]hospitality['"][^\]]*)\]/m;
    if (looseArray.test(mountSrc)) {
      mountSrc = mountSrc.replace(looseArray, (all, inner) => {
        if (inner.includes("chc")) return all;
        return `[${inner}, 'chc']`;
      });
    } else {
      // As last resort, if file imports canonical specs, add chc import and register it.
      // We only do this if we see ciag/hospitality domain.json imports.
      if (mountSrc.includes("ciag.domain.json") && mountSrc.includes("hospitality.domain.json")) {
        // Add import for chc.domain.json next to others.
        const importSpot = /import\s+.*ciag\.domain\.json.*\n/m;
        if (!importSpot.test(mountSrc)) {
          throw new Error(`Invariant: ${mountFile} references ciag.domain.json but import anchor not found.`);
        }
        if (!mountSrc.includes("chc.domain.json")) {
          mountSrc = mountSrc.replace(importSpot, (line) => line + `import chcSpec from "../domains/chc.domain.json";\n`);
        }

        // Register chcSpec in the first array that contains both ciag/hospitality specs.
        const specArray = /\[\s*([^\]]*\bciagSpec\b[^\]]*\bhospitalitySpec\b[^\]]*)\]/m;
        if (!specArray.test(mountSrc)) {
          throw new Error(`Invariant: could not locate [ciagSpec, hospitalitySpec, ...] array in ${mountFile}.`);
        }
        mountSrc = mountSrc.replace(specArray, (all, inner) => {
          if (inner.includes("chcSpec")) return all;
          return `[${inner}, chcSpec]`;
        });
      } else {
        throw new Error(
          `Invariant: candidate mount file (${mountFile}) does not expose a patchable array/map/import pattern for chc.\n` +
          `Run: sed -n '1,260p' ${mountFile}`
        );
      }
    }
  }

  writeIfChanged(mountFile, mountSrc);
  console.log(`OK: injected chc into mount registry in ${mountFile}`);
}

// 4) Gates (must end with npm run build)
run("npm test");
run("npm run build");
