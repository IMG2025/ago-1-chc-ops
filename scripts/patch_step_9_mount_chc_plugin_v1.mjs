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
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const CHC_SPEC = "domains/chc.domain.json";
if (!exists(CHC_SPEC)) throw new Error(`Missing: ${CHC_SPEC} (Step 9 spec must exist)`);

// ------------------------------
// 1) Fix smoke_authorize_chc.sh to use DomainRegistry like hospitality smoke
// ------------------------------
const SMOKE_HOSP = "scripts/smoke_authorize_hospitality.sh";
const SMOKE_CHC  = "scripts/smoke_authorize_chc.sh";

if (!exists(SMOKE_HOSP)) throw new Error(`Missing: ${SMOKE_HOSP} (required as template)`);

const hosp = read(SMOKE_HOSP);

// Clone hospitality smoke -> CHC smoke via conservative substitutions.
// This preserves the known-good authorize pattern: r.authorize(domain,...)
let chcSmoke = hosp
  .replaceAll("hospitality", "chc")
  .replaceAll("HOSPITALITY", "CHC");

// Ensure the error message refers to CHC (not required, but clarity).
chcSmoke = chcSmoke.replaceAll("Missing hospitality domain", "Missing chc domain");

writeIfChanged(SMOKE_CHC, chcSmoke.endsWith("\n") ? chcSmoke : chcSmoke + "\n");
chmod755(SMOKE_CHC);

// ------------------------------
// 2) Ensure package.json test chain includes smoke_authorize_chc.sh (idempotent)
// ------------------------------
const pkgPath = "package.json";
if (!exists(pkgPath)) throw new Error("Missing: package.json");
const pkg = JSON.parse(read(pkgPath));
const testCmd = pkg.scripts?.test;
if (typeof testCmd !== "string") throw new Error("Invariant: package.json scripts.test missing or not a string.");

if (!testCmd.includes("smoke_authorize_chc.sh")) {
  let next = testCmd;
  if (testCmd.includes("smoke_authorize_hospitality.sh")) {
    next = testCmd.replace(
      "./scripts/smoke_authorize_hospitality.sh",
      "./scripts/smoke_authorize_hospitality.sh && ./scripts/smoke_authorize_chc.sh"
    );
  } else if (testCmd.includes("smoke_authorize.sh")) {
    next = testCmd.replace(
      "./scripts/smoke_authorize.sh",
      "./scripts/smoke_authorize.sh && ./scripts/smoke_authorize_chc.sh"
    );
  } else {
    next = testCmd + " && ./scripts/smoke_authorize_chc.sh";
  }
  pkg.scripts.test = next;
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
}

// ------------------------------
// 3) Patch the real mountCHCOpsPlugins() implementation to mount CHC
//    Source candidates from your rg output: src/index.ts and src/plugin.ts
//    We choose the one that actually mentions ciag + hospitality in its body.
// ------------------------------
const candidates = ["src/index.ts", "src/plugin.ts"].filter(exists);
if (!candidates.length) throw new Error("Invariant: missing src/index.ts and src/plugin.ts");

function scoreMountFile(p) {
  const t = read(p);
  let s = 0;
  if (t.includes("export function mountCHCOpsPlugins")) s += 10;
  if (t.includes("ciag")) s += 3;
  if (t.includes("hospitality")) s += 3;
  if (t.includes("DomainRegistry")) s += 1;
  return s;
}

candidates.sort((a,b)=>scoreMountFile(b)-scoreMountFile(a));
const mountFile = candidates[0];
let mountSrc = read(mountFile);

if (!mountSrc.includes("export function mountCHCOpsPlugins")) {
  throw new Error(`Invariant: ${mountFile} did not contain export function mountCHCOpsPlugins().`);
}

// If already wired, noop.
if (mountSrc.includes("chc.domain.json") || mountSrc.includes("'chc'") || mountSrc.includes('"chc"') || mountSrc.includes("chcSpec")) {
  // already mounted somewhere in this file; continue
} else {
  // Strategy:
  // A) If the file imports ciag/hospitality domain.json specs, add chc import adjacent.
  // B) If the file registers a list/array that includes ciag + hospitality, append chc in the same structure.
  //
  // We do not invent new registry APIs; we only extend existing patterns.

  // A) Add import chcSpec if we see ciagSpec/hospitalitySpec JSON imports.
  const hasCiagJson = /ciag\.domain\.json/.test(mountSrc);
  const hasHospJson = /hospitality\.domain\.json/.test(mountSrc);

  if (hasCiagJson && hasHospJson && !/chc\.domain\.json/.test(mountSrc)) {
    // Insert chc import after the hospitality import if present, else after ciag import.
    const hospImport = mountSrc.match(/^import .*hospitality\.domain\.json.*$/m)?.[0] ?? null;
    const ciagImport = mountSrc.match(/^import .*ciag\.domain\.json.*$/m)?.[0] ?? null;

    if (hospImport) {
      mountSrc = mountSrc.replace(
        hospImport,
        hospImport + `\nimport chcSpec from "../domains/chc.domain.json";`
      );
    } else if (ciagImport) {
      mountSrc = mountSrc.replace(
        ciagImport,
        ciagImport + `\nimport chcSpec from "../domains/chc.domain.json";`
      );
    } else {
      throw new Error(`Invariant: ${mountFile} references domain.json but import anchor not found.`);
    }
  }

  // B1) If there is a spec array like [ciagSpec, hospitalitySpec, ...], append chcSpec.
  const specArray = /\[\s*([^\]]*\bciagSpec\b[^\]]*\bhospitalitySpec\b[^\]]*)\]/m;
  if (specArray.test(mountSrc)) {
    mountSrc = mountSrc.replace(specArray, (all, inner) => {
      if (inner.includes("chcSpec")) return all;
      return `[${inner}, chcSpec]`;
    });
    writeIfChanged(mountFile, mountSrc);
    console.log(`OK: appended chcSpec into canonical spec array in ${mountFile}`);
  } else {
    // B2) If there is a domain id list like ['ciag','hospitality'], append 'chc'
    const idArray = /\[\s*['"]ciag['"]\s*,\s*['"]hospitality['"]\s*\]/m;
    const looseIdArray = /\[\s*([^\]]*['"]ciag['"][^\]]*['"]hospitality['"][^\]]*)\]/m;
    if (idArray.test(mountSrc)) {
      mountSrc = mountSrc.replace(idArray, `['ciag','hospitality','chc']`);
      writeIfChanged(mountFile, mountSrc);
      console.log(`OK: appended 'chc' into mounted domain id list in ${mountFile}`);
    } else if (looseIdArray.test(mountSrc)) {
      mountSrc = mountSrc.replace(looseIdArray, (all, inner) => {
        if (inner.includes("chc")) return all;
        return `[${inner}, 'chc']`;
      });
      writeIfChanged(mountFile, mountSrc);
      console.log(`OK: appended 'chc' into mounted domain id list (loose match) in ${mountFile}`);
    } else {
      throw new Error(
        `Invariant: located mount file (${mountFile}) but could not find a patchable ciag/hospitality spec array or domain id list to extend.\n` +
        `Run:\n  sed -n '1,260p' ${mountFile}\n  rg -n "ciag|hospitality|domain\\.json|register|mountCHCOpsPlugins" ${mountFile}`
      );
    }
  }
}

// ------------------------------
// 4) Tighten the two mount-related scripts to expect chc in listDomains()
// ------------------------------
const smokeList = "scripts/smoke_list_domains.sh";
const auditMount = "scripts/audit_mount_canonical_specs.sh";

if (!exists(smokeList)) throw new Error(`Missing: ${smokeList}`);
if (!exists(auditMount)) throw new Error(`Missing: ${auditMount}`);

// smoke_list_domains: include chc expectation (idempotent)
let sld = read(smokeList);
if (!sld.includes(`domains.includes("chc")`)) {
  // Add to the existing expectation line that checks ciag + hospitality
  sld = sld.replace(
    /if\s*\(!domains\.includes\("ciag"\)\s*\|\|\s*!domains\.includes\("hospitality"\)\)\s*\{/m,
    `if (!domains.includes("ciag") || !domains.includes("hospitality") || !domains.includes("chc")) {`
  );
  // Update the error text (best-effort)
  sld = sld.replaceAll("expected ciag + hospitality", "expected ciag + hospitality + chc");
  writeIfChanged(smokeList, sld);
}

// audit_mount_canonical_specs: assert chc exists and canonical scopes (idempotent)
let am = read(auditMount);
if (!am.includes('const chc = r.get("chc");')) {
  // Insert after ciag/hospitality gets.
  am = am.replace(
    /const h = r\.get\("hospitality"\);\s*\nconst c = r\.get\("ciag"\);\s*\n/m,
    `const h = r.get("hospitality");\nconst c = r.get("ciag");\nconst chc = r.get("chc");\n`
  );

  // Add assertions after ciag asserts block.
  const insertAfter = 'assert(c.required_scopes?.ESCALATE?.[0] === "ciag:escalate", "ciag ESCALATE scope not canonical");';
  if (!am.includes(insertAfter)) {
    throw new Error("Invariant: could not locate ciag ESCALATE assertion anchor in audit_mount_canonical_specs.sh");
  }
  am = am.replace(
    insertAfter,
    insertAfter + `

assert(chc, "chc domain missing");
assert(chc.required_scopes?.EXECUTE?.[0] === "chc:execute", "chc EXECUTE scope not canonical");
assert(chc.required_scopes?.ANALYZE?.[0] === "chc:analyze" || chc.required_scopes?.ANALYZE?.[0] === "chc:read", "chc ANALYZE scope not canonical");
assert(chc.required_scopes?.ESCALATE?.[0] === "chc:escalate", "chc ESCALATE scope not canonical");`
  );

  // Update final OK line
  am = am.replaceAll("hospitality + ciag", "hospitality + ciag + chc");
  writeIfChanged(auditMount, am);
}

chmod755(smokeList);
chmod755(auditMount);
chmod755(SMOKE_CHC);

console.log("OK: Step 9 mounted CHC + fixed CHC smoke + updated mount audits.");

// ------------------------------
// 5) Gates (must end with npm run build)
// ------------------------------
run("npm test");
run("npm run build");
