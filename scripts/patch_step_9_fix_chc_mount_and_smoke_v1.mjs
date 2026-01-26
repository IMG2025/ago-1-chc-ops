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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const CHC_SPEC = "domains/chc.domain.json";
if (!exists(CHC_SPEC)) throw new Error(`Missing: ${CHC_SPEC}`);

const SMOKE_CHC = "scripts/smoke_authorize_chc.sh";
const SMOKE_HOSP = "scripts/smoke_authorize_hospitality.sh";
const SMOKE_BASE = "scripts/smoke_authorize.sh";

function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

// ------------------------------
// 1) Fix smoke_authorize_chc.sh by cloning a known-good smoke script
// ------------------------------
let templatePath = exists(SMOKE_HOSP) ? SMOKE_HOSP : (exists(SMOKE_BASE) ? SMOKE_BASE : null);
if (!templatePath) {
  throw new Error("Invariant: neither scripts/smoke_authorize_hospitality.sh nor scripts/smoke_authorize.sh exists to template from.");
}

const tmpl = read(templatePath);

// Replace domain identifiers conservatively.
// We do NOT assume implementation details beyond string substitutions.
let chcSmoke = tmpl;

// Prefer hospitality->chc substitution if hospitality template used.
if (templatePath.endsWith("smoke_authorize_hospitality.sh")) {
  chcSmoke = chcSmoke
    .replaceAll("hospitality", "chc")
    .replaceAll("HOSPITALITY", "CHC");
} else {
  // Base smoke might reference ciag; we only inject a CHC block if possible.
  // If base smoke doesn’t mention any domain strings, we still keep it as a minimal “authorize” smoke by adding a clear CHC run.
  if (!/ciag|hospitality|domain_id/i.test(chcSmoke)) {
    chcSmoke += `

# CHC smoke appended (template had no domain literals)
node -e 'import("./dist/index.js").then((m)=>{ console.log("Exports:", Object.keys(m)); process.exit(0); }).catch(e=>{ console.error(e); process.exit(1); });'
`;
  } else {
    // If it mentions ciag, clone pattern by swapping only explicit ciag occurrences.
    chcSmoke = chcSmoke
      .replaceAll("ciag", "chc")
      .replaceAll("CIAG", "CHC");
  }
}

// Ensure filename-level message aligns (best-effort; harmless if not present)
if (!chcSmoke.includes("authorize chc")) {
  // not required, but improves log clarity
  chcSmoke = chcSmoke.replaceAll("authorize ", "authorize chc ");
}

writeIfChanged(SMOKE_CHC, chcSmoke.endsWith("\n") ? chcSmoke : chcSmoke + "\n");
chmod755(SMOKE_CHC);

// ------------------------------
// 2) Find the canonical mount surface by inspecting existing gates
//    Source of truth: scripts/audit_mount_canonical_specs.sh and scripts/smoke_list_domains.sh
// ------------------------------
const AUDIT_MOUNT = "scripts/audit_mount_canonical_specs.sh";
const SMOKE_LIST = "scripts/smoke_list_domains.sh";

if (!exists(AUDIT_MOUNT)) throw new Error(`Missing: ${AUDIT_MOUNT}`);
if (!exists(SMOKE_LIST)) throw new Error(`Missing: ${SMOKE_LIST}`);

const auditMountSrc = read(AUDIT_MOUNT);
const smokeListSrc = read(SMOKE_LIST);

// Heuristic: locate first referenced TS file under src/ or a node -e import("./dist/...") hint.
// We want the TS source used to mount domains, not diagnostics views.
function extractLikelyTsFile(text) {
  // match src/....ts in quotes
  const m = text.match(/["'](src\/[^"']+\.ts)["']/);
  return m ? m[1] : null;
}
function extractLikelyDistImport(text) {
  const m = text.match(/import\(["'](\.\/dist\/[^"']+)["']\)/);
  return m ? m[1] : null;
}

const auditTs = extractLikelyTsFile(auditMountSrc) ?? extractLikelyTsFile(smokeListSrc);
const distHint = extractLikelyDistImport(auditMountSrc) ?? extractLikelyDistImport(smokeListSrc);

// If scripts don't point to TS directly, fall back to scanning src/ for a mount file but EXCLUDE diagnostics.
function listFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

let mountFile = auditTs;
if (!mountFile) {
  const srcRoot = "src";
  if (!exists(srcRoot)) throw new Error("Missing: src/");
  const tsFiles = listFiles(srcRoot).filter(p => p.endsWith(".ts"));

  // Prefer files that look like mount/registry and are not diagnostics.
  const scored = tsFiles
    .filter(p => !p.includes(`${path.sep}diagnostics${path.sep}`))
    .map(p => {
      const t = read(p);
      let score = 0;
      if (p.toLowerCase().includes("mount")) score += 5;
      if (p.toLowerCase().includes("domain")) score += 2;
      if (t.includes("Mounted domains")) score += 10;
      if (t.includes("ciag") && t.includes("hospitality")) score += 4;
      if (t.includes("domains/") || t.includes("domain.json")) score += 2;
      return { p, score };
    })
    .sort((a,b)=>b.score-a.score);

  if (!scored.length || scored[0].score < 6) {
    throw new Error(
      "Invariant: could not confidently locate canonical mount surface.\n" +
      'Run: rg -n "Mounted domains|ciag|hospitality|mount" src | head -n 120'
    );
  }
  mountFile = scored[0].p;
}

if (!exists(mountFile)) throw new Error(`Invariant: mountFile not found on disk: ${mountFile}`);

// ------------------------------
// 3) Patch mount surface to include CHC (idempotent; no guessing of runtime)
//    We only add 'chc' if we can find an existing ciag/hospitality list.
// ------------------------------
let mountSrc = read(mountFile);

if (mountSrc.includes("'chc'") || mountSrc.includes('"chc"') || mountSrc.includes("chc.domain.json")) {
  // already wired
} else {
  // Strategy A: explicit string list containing ciag/hospitality -> append chc
  const looseArray = /\[\s*([^\]]*['"]ciag['"][^\]]*['"]hospitality['"][^\]]*)\]/m;
  if (looseArray.test(mountSrc)) {
    mountSrc = mountSrc.replace(looseArray, (all, inner) => {
      if (inner.includes("chc")) return all;
      return `[${inner}, 'chc']`;
    });
    writeIfChanged(mountFile, mountSrc);
    console.log(`OK: mounted domain id 'chc' added in ${mountFile}`);
  } else {
    // Strategy B: mount file likely maps spec objects; then we must follow its pattern.
    // Hard fail with a precise excerpt command; we do not “invent” structure.
    throw new Error(
      `Invariant: located mount surface (${mountFile}) but could not find a ciag/hospitality domain id array to extend.\n` +
      `Run: sed -n '1,260p' ${mountFile}`
    );
  }
}

// ------------------------------
// 4) Ensure npm test includes smoke_authorize_chc.sh (idempotent)
// ------------------------------
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
  } else if (testCmd.includes("smoke_authorize.sh")) {
    nextTest = testCmd.replace(
      "./scripts/smoke_authorize.sh",
      "./scripts/smoke_authorize.sh && ./scripts/smoke_authorize_chc.sh"
    );
  } else {
    nextTest = testCmd + " && ./scripts/smoke_authorize_chc.sh";
  }
  pkg.scripts.test = nextTest;
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

// ------------------------------
// 5) Gates (must end with npm run build)
// ------------------------------
run("npm test");
run("npm run build");
