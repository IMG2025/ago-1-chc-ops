#!/usr/bin/env node
import fs from "node:fs";
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

const EXECUTORS = "src/executors.ts";
const INDEX = "src/index.ts";
const PLUGIN = "src/plugin.ts";

if (!exists(EXECUTORS)) throw new Error(`Missing: ${EXECUTORS}`);
if (!exists(INDEX)) throw new Error(`Missing: ${INDEX}`);
if (!exists(PLUGIN)) throw new Error(`Missing: ${PLUGIN}`);

// ------------------------------
// 1) Add chcExecutorSpec to src/executors.ts (idempotent)
//    We mirror the existing executor spec style by pattern-matching.
// ------------------------------
let ex = read(EXECUTORS);

if (!ex.includes("chcExecutorSpec")) {
  // We expect existing exports like: export const hospitalityExecutorSpec = { ... }
  // Insert CHC spec after ciagExecutorSpec if present, else after hospitalityExecutorSpec.
  const anchor =
    ex.includes("ciagExecutorSpec") ? "ciagExecutorSpec" :
    ex.includes("hospitalityExecutorSpec") ? "hospitalityExecutorSpec" :
    null;

  if (!anchor) {
    throw new Error(
      `Invariant: could not find hospitalityExecutorSpec or ciagExecutorSpec in ${EXECUTORS}.\n` +
      `Run: sed -n '1,260p' ${EXECUTORS}`
    );
  }

  // Determine insertion point: after the export block that defines the anchor spec.
  // We locate the first occurrence of `export const <anchor>` and then the next `};`
  const re = new RegExp(`export\\s+const\\s+${anchor}\\s*=\\s*\\{[\\s\\S]*?\\n\\};\\n`, "m");
  const m = ex.match(re);
  if (!m) {
    throw new Error(
      `Invariant: found ${anchor} but could not match its export block in ${EXECUTORS}.\n` +
      `Run: rg -n "export const ${anchor}" ${EXECUTORS} && sed -n '1,260p' ${EXECUTORS}`
    );
  }

  const block = m[0];
  const insertAfter = block;

  // Minimal, canonical CHC executor spec consistent with others:
  // - domain_id "chc"
  // - supported_task_types EXECUTE/ANALYZE/ESCALATE
  // - required_scopes map with domain-prefixed scopes
  //
  // NOTE: We do not assume additional fields. If the existing specs include extra keys,
  // this still compiles because it's an object literal used as "unknown"/structural.
  const chcBlock = `export const chcExecutorSpec = {
  domain_id: "chc",
  name: "CHC Ops",
  version: "v1",
  supported_task_types: ["EXECUTE", "ANALYZE", "ESCALATE"],
  required_scopes: {
    EXECUTE: ["chc:execute"],
    ANALYZE: ["chc:analyze"],
    ESCALATE: ["chc:escalate"],
  },
};
`;

  ex = ex.replace(insertAfter, insertAfter + "\n" + chcBlock);
  writeIfChanged(EXECUTORS, ex);
  console.log(`OK: added chcExecutorSpec to ${EXECUTORS}`);
} else {
  console.log(`OK: ${EXECUTORS} already contains chcExecutorSpec (no changes).`);
}

// ------------------------------
// 2) Wire chcExecutorSpec into src/index.ts mount (idempotent)
// ------------------------------
let idx = read(INDEX);

// Ensure import line includes chcExecutorSpec
// Current: import { hospitalityExecutorSpec, ciagExecutorSpec } from "./executors.js";
if (idx.includes('from "./executors.js"')) {
  if (!idx.includes("chcExecutorSpec")) {
    idx = idx.replace(
      /import\s+\{\s*([^}]+)\s*\}\s+from\s+"\.\/executors\.js";/m,
      (all, inner) => {
        const parts = inner.split(",").map(s => s.trim()).filter(Boolean);
        if (!parts.includes("chcExecutorSpec")) parts.push("chcExecutorSpec");
        return `import { ${parts.join(", ")} } from "./executors.js";`;
      }
    );
  }
} else {
  throw new Error(`Invariant: could not locate executors import in ${INDEX}.`);
}

// Ensure mount registers chcExecutorSpec
if (!idx.includes("registry.registerExecutor(chcExecutorSpec)")) {
  const mountAnchor = "registry.registerExecutor(ciagExecutorSpec);";
  if (idx.includes(mountAnchor)) {
    idx = idx.replace(
      mountAnchor,
      mountAnchor + "\n  registry.registerExecutor(chcExecutorSpec);"
    );
  } else {
    // fallback: if mount is single-line with two calls
    const oneLine = /registry\.registerExecutorhospitalityExecutorSpec;\s*registry\.registerExecutorciagExecutorSpec;/m;
    if (oneLine.test(idx)) {
      idx = idx.replace(oneLine, (s) => s + " registry.registerExecutor(chcExecutorSpec);");
    } else {
      throw new Error(
        `Invariant: could not locate mount registry registration for ciag in ${INDEX}.\n` +
        `Run: sed -n '1,160p' ${INDEX}`
      );
    }
  }
}
writeIfChanged(INDEX, idx);
console.log(`OK: wired chcExecutorSpec into ${INDEX}`);

// ------------------------------
// 3) Wire CHC into src/plugin.ts compatibility mount (idempotent)
//    plugin.ts currently only imports hospitalityExecutorSpec and registers hospitality.
// ------------------------------
let pl = read(PLUGIN);

// Ensure chcExecutorSpec imported
if (!pl.includes('from "./executors.js"')) {
  throw new Error(`Invariant: could not locate executors import in ${PLUGIN}.`);
}
if (!pl.includes("chcExecutorSpec")) {
  pl = pl.replace(
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+"\.\/executors\.js";/m,
    (all, inner) => {
      const parts = inner.split(",").map(s => s.trim()).filter(Boolean);
      if (!parts.includes("chcExecutorSpec")) parts.push("chcExecutorSpec");
      return `import { ${parts.join(", ")} } from "./executors.js";`;
    }
  );
}

// Add registerCHC function (parallel to registerHospitality)
if (!pl.includes("export function registerCHC")) {
  const anchorFn = "export function registerHospitality";
  const pos = pl.indexOf(anchorFn);
  if (pos === -1) {
    throw new Error(`Invariant: could not find registerHospitality in ${PLUGIN}.`);
  }

  // Insert immediately after registerHospitality block end `}` followed by newline.
  // Find the first occurrence of `export function registerHospitality` block end.
  const reHospFn = /export function registerHospitality[\s\S]*?\n}\n/m;
  const m = pl.match(reHospFn);
  if (!m) {
    throw new Error(`Invariant: could not match registerHospitality block in ${PLUGIN}.`);
  }
  const hospBlock = m[0];

  const chcFn = `export function registerCHC(register: RegisterExecutorFn): void {
  register(chcExecutorSpec);
}
`;
  pl = pl.replace(hospBlock, hospBlock + "\n" + chcFn);
}

// Ensure compatibility mount calls registerCHC(register)
if (!pl.includes("registerCHC(register);")) {
  const anchor = "registerHospitality(register);";
  if (!pl.includes(anchor)) {
    throw new Error(`Invariant: could not locate registerHospitality(register) call in ${PLUGIN}.`);
  }
  pl = pl.replace(anchor, anchor + "\n  registerCHC(register);");
}

writeIfChanged(PLUGIN, pl);
console.log(`OK: wired CHC into ${PLUGIN}`);

// ------------------------------
// 4) Fix smoke_authorize_chc.sh to be registry-based (idempotent)
// ------------------------------
const SMOKE_HOSP = "scripts/smoke_authorize_hospitality.sh";
const SMOKE_CHC  = "scripts/smoke_authorize_chc.sh";
if (!exists(SMOKE_HOSP)) throw new Error(`Missing: ${SMOKE_HOSP}`);
let chcSmoke = read(SMOKE_HOSP)
  .replaceAll("hospitality", "chc")
  .replaceAll("HOSPITALITY", "CHC")
  .replaceAll("Missing hospitality domain", "Missing chc domain");

writeIfChanged(SMOKE_CHC, chcSmoke.endsWith("\n") ? chcSmoke : chcSmoke + "\n");
chmod755(SMOKE_CHC);
console.log("OK: smoke_authorize_chc.sh is registry-based.");

// ------------------------------
// 5) Update smoke_list_domains + audit_mount to expect CHC (idempotent)
// ------------------------------
const smokeList = "scripts/smoke_list_domains.sh";
const auditMount = "scripts/audit_mount_canonical_specs.sh";
if (!exists(smokeList)) throw new Error(`Missing: ${smokeList}`);
if (!exists(auditMount)) throw new Error(`Missing: ${auditMount}`);

// smoke_list_domains: expect chc too
let sld = read(smokeList);
if (!sld.includes(`domains.includes("chc")`)) {
  sld = sld.replace(
    /if\s*!domains\.includes\("ciag"\s*\|\|\s*!domains\.includes"hospitality"\)\s*\{/m,
    `if (!domains.includes("ciag") || !domains.includes("hospitality") || !domains.includes("chc")) {`
  );
  sld = sld.replaceAll("expected ciag + hospitality", "expected ciag + hospitality + chc");
  writeIfChanged(smokeList, sld);
}

// audit_mount_canonical_specs: assert chc exists + canonical scopes
let am = read(auditMount);
if (!am.includes('const chc = r.get("chc");')) {
  am = am.replace(
    /const h = r\.get"hospitality";\s*\nconst c = r\.get"ciag";\s*\n/m,
    `const h = r.get("hospitality");\nconst c = r.get("ciag");\nconst chc = r.get("chc");\n`
  );

  const insertAfter = 'assert(c.required_scopes?.ESCALATE?.[0] === "ciag:escalate", "ciag ESCALATE scope not canonical");';
  if (!am.includes(insertAfter)) {
    throw new Error("Invariant: could not locate ciag ESCALATE assertion anchor in audit_mount_canonical_specs.sh");
  }
  am = am.replace(
    insertAfter,
    insertAfter + `

assert(chc, "chc domain missing");
assert(chc.required_scopes?.EXECUTE?.[0] === "chc:execute", "chc EXECUTE scope not canonical");
assert(chc.required_scopes?.ANALYZE?.[0] === "chc:analyze", "chc ANALYZE scope not canonical");
assert(chc.required_scopes?.ESCALATE?.[0] === "chc:escalate", "chc ESCALATE scope not canonical");`
  );

  am = am.replaceAll("hospitality + ciag", "hospitality + ciag + chc");
  writeIfChanged(auditMount, am);
}

chmod755(smokeList);
chmod755(auditMount);

console.log("OK: updated mount smoke/audit expectations for chc.");

// ------------------------------
// 6) Gates (must end with npm run build)
// ------------------------------
run("npm test");
run("npm run build");
