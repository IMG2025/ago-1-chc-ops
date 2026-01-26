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
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); }
function exists(p) { return fs.existsSync(p); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

// ---- Paths (best-effort discovery to avoid assumptions) ----
const DOMAINS_DIR = "domains";
ensureDir(DOMAINS_DIR);

const chcSpecPath = path.join(DOMAINS_DIR, "chc.domain.json");

// Keep scopes consistent with existing namespace discipline (domain-prefixed)
const chcSpec = {
  domain_id: "chc",
  name: "CHC Ops",
  version: "v1",
  scopes: {
    ANALYZE: ["chc:read", "chc:analyze"],
    EXECUTE: ["chc:execute"],
    ESCALATE: ["chc:escalate"]
  },
  tasks: [
    { task_type: "ANALYZE", required_scope_any: ["chc:read", "chc:analyze"] },
    { task_type: "EXECUTE", required_scope_any: ["chc:execute"] },
    { task_type: "ESCALATE", required_scope_any: ["chc:escalate"] }
  ]
};

writeIfChanged(chcSpecPath, JSON.stringify(chcSpec, null, 2) + "\n");

// ---- Wire domain mount ----
// We search for an existing "mounted domains" list/registry file by convention.
const mountCandidates = [
  "src/mount_domains.ts",
  "src/mount_domains_v1.ts",
  "src/domains/mount.ts",
  "src/domains/mount_v1.ts",
  "src/index.ts"
].filter(exists);

if (mountCandidates.length === 0) {
  throw new Error("Invariant: could not find a mount file to register domains (searched common candidates).");
}

// Choose the first candidate and patch conservatively by inserting 'chc' into the mounted domains list.
const mountFile = mountCandidates[0];
const prevMount = read(mountFile);

// Heuristic: find the literal array that includes 'ciag' and 'hospitality'
const arrayPattern = /\[\s*['"]ciag['"]\s*,\s*['"]hospitality['"]\s*\]/m;
if (!arrayPattern.test(prevMount)) {
  // If the array is already expanded or in different order, try a looser match.
  const loosePattern = /\[\s*([^\]]*['"]ciag['"][^\]]*['"]hospitality['"][^\]]*)\]/m;
  const m = prevMount.match(loosePattern);
  if (!m) {
    throw new Error(`Invariant: could not locate mounted domains array containing ciag + hospitality in ${mountFile}.`);
  }
}

// If already includes 'chc', noop.
if (!prevMount.includes("'chc'") && !prevMount.includes('"chc"')) {
  const nextMount = prevMount.replace(arrayPattern, `['ciag','hospitality','chc']`);
  if (nextMount === prevMount) {
    // Fallback: insert before closing bracket of the first matched loose array.
    const loose = prevMount.replace(
      /\[\s*([^\]]*['"]ciag['"][^\]]*['"]hospitality['"][^\]]*)\]/m,
      (all, inner) => {
        if (inner.includes("chc")) return all;
        return `[${inner}, 'chc']`;
      }
    );
    writeIfChanged(mountFile, loose);
  } else {
    writeIfChanged(mountFile, nextMount);
  }
}

// ---- Add CHC authorize smoke ----
const smoke = "scripts/smoke_authorize_chc.sh";
const smokeSrc = `#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Keep consistent with other smoke scripts; rely on existing CLI entrypoints.
node -e 'import("./dist/index.js").then(async (m)=>{ const { authorize } = m; const base = { domain_id:"chc", actor:{ subject_id:"u1", role:"operator" } }; const ok1 = authorize({ ...base, task_type:"EXECUTE", requested_scope:["chc:execute"] }); if (ok1.decision!=="ALLOW") throw new Error("expected ALLOW"); const ok2 = authorize({ ...base, task_type:"ANALYZE", requested_scope:["chc:read"] }); if (ok2.decision!=="ALLOW") throw new Error("expected ALLOW"); const ok3 = authorize({ ...base, task_type:"ESCALATE", requested_scope:["chc:escalate"] }); if (ok3.decision!=="ALLOW") throw new Error("expected ALLOW"); const bad = authorize({ ...base, task_type:"EXECUTE", requested_scope:["hospitality:execute"] }); if (bad.decision!=="DENY") throw new Error("expected DENY"); console.log("OK: authorize chc EXECUTE/ANALYZE/ESCALATE + cross-namespace deny"); }).catch(e=>{ console.error(e); process.exit(1); });'
`;
writeIfChanged(smoke, smokeSrc);
fs.chmodSync(smoke, 0o755);

// ---- Wire smoke into npm test chain ----
const pkgPath = "package.json";
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));

const testCmd = pkg.scripts?.test;
if (typeof testCmd !== "string") throw new Error("Invariant: package.json scripts.test missing or not a string.");

if (!testCmd.includes("smoke_authorize_chc.sh")) {
  // Insert after existing smoke_authorize_hospitality if present; else append near other smoke gates.
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

console.log("OK: Step 9 CHC domain added (spec + mount + smoke).");

// ---- Gates (must end with npm run build) ----
run("npm test");
run("npm run build");
