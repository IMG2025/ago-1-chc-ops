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

// ------------------------------------------------------------
// 1) Ensure chcExecutorSpec exists by appending to executors.ts
// ------------------------------------------------------------
let ex = read(EXECUTORS);
if (!ex.includes("chcExecutorSpec")) {
  const block = `

/**
 * CHC Ops executor spec (Step 9)
 * Keep this aligned with DomainRegistry expectations (domain_id + task types + required scopes).
 */
export const chcExecutorSpec = {
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
  ex = ex.endsWith("\n") ? (ex + block) : (ex + "\n" + block);
  writeIfChanged(EXECUTORS, ex);
  console.log(`OK: appended chcExecutorSpec to ${EXECUTORS}`);
} else {
  console.log(`OK: ${EXECUTORS} already has chcExecutorSpec`);
}

// ------------------------------------------------------------
// 2) Patch src/index.ts to import + register chcExecutorSpec
//    Known current content (from your dump):
//      import { hospitalityExecutorSpec, ciagExecutorSpec } from "./executors.js";
//      ...
//      registry.registerExecutor(hospitalityExecutorSpec); registry.registerExecutor(ciagExecutorSpec);
// ------------------------------------------------------------
let idx = read(INDEX);

// Import: add chcExecutorSpec into the braces.
if (idx.includes('from "./executors.js";') && !idx.includes("chcExecutorSpec")) {
  idx = idx.replace(
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+"\.\/executors\.js";/m,
    (all, inner) => {
      const parts = inner.split(",").map(s => s.trim()).filter(Boolean);
      if (!parts.includes("chcExecutorSpec")) parts.push("chcExecutorSpec");
      return `import { ${parts.join(", ")} } from "./executors.js";`;
    }
  );
}

// Register: append a third register call, handling one-line or multi-line.
if (!idx.includes("registerExecutor(chcExecutorSpec)")) {
  // Your current mount function has both calls on one line; patch that exact pattern first.
  const oneLine = /registry\.registerExecutor\(hospitalityExecutorSpec\);\s*registry\.registerExecutor\(ciagExecutorSpec\);/m;
  if (oneLine.test(idx)) {
    idx = idx.replace(oneLine, (s) => s + " registry.registerExecutor(chcExecutorSpec);");
  } else if (idx.includes("registry.registerExecutor(ciagExecutorSpec);")) {
    idx = idx.replace(
      "registry.registerExecutor(ciagExecutorSpec);",
      "registry.registerExecutor(ciagExecutorSpec);\n  registry.registerExecutor(chcExecutorSpec);"
    );
  } else {
    throw new Error(
      `Invariant: could not locate where index.ts registers ciag/hospitality executors.\n` +
      `Run: sed -n '1,140p' ${INDEX}`
    );
  }
}

writeIfChanged(INDEX, idx);
console.log(`OK: wired CHC into ${INDEX}`);

// ------------------------------------------------------------
// 3) Patch src/plugin.ts compatibility mount
//    Known current content (from your dump):
//      import { hospitalityExecutorSpec } from "./executors.js";
//      ...
//      export function registerHospitality(...) { ... }
//      export function mountCHCOpsPlugins(...) { ... registerHospitality(register); }
// ------------------------------------------------------------
let pl = read(PLUGIN);

// Import: ensure chcExecutorSpec is imported
if (pl.includes('from "./executors.js";') && !pl.includes("chcExecutorSpec")) {
  pl = pl.replace(
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+"\.\/executors\.js";/m,
    (all, inner) => {
      const parts = inner.split(",").map(s => s.trim()).filter(Boolean);
      if (!parts.includes("chcExecutorSpec")) parts.push("chcExecutorSpec");
      return `import { ${parts.join(", ")} } from "./executors.js";`;
    }
  );
}

// Add registerCHC if missing
if (!pl.includes("export function registerCHC")) {
  const hospFnRe = /export function registerHospitality[\s\S]*?\n}\n/m;
  const m = pl.match(hospFnRe);
  if (!m) {
    throw new Error(
      `Invariant: could not match registerHospitality() function block in ${PLUGIN}.\n` +
      `Run: sed -n '1,220p' ${PLUGIN}`
    );
  }
  const hospBlock = m[0];
  const chcFn = `export function registerCHC(register: RegisterExecutorFn): void {
  register(chcExecutorSpec);
}
`;
  pl = pl.replace(hospBlock, hospBlock + "\n" + chcFn);
}

// Ensure mount calls registerCHC(register)
if (!pl.includes("registerCHC(register);")) {
  const anchor = "registerHospitality(register);";
  if (!pl.includes(anchor)) {
    throw new Error(
      `Invariant: could not locate registerHospitality(register); call in ${PLUGIN}.\n` +
      `Run: rg -n "registerHospitality\\(register\\)" ${PLUGIN}`
    );
  }
  pl = pl.replace(anchor, anchor + "\n  registerCHC(register);");
}

writeIfChanged(PLUGIN, pl);
console.log(`OK: wired CHC into ${PLUGIN}`);

// ------------------------------------------------------------
// 4) Ensure smoke_authorize_chc.sh is registry-based (clone hospitality smoke)
// ------------------------------------------------------------
const SMOKE_HOSP = "scripts/smoke_authorize_hospitality.sh";
const SMOKE_CHC = "scripts/smoke_authorize_chc.sh";
if (!exists(SMOKE_HOSP)) throw new Error(`Missing: ${SMOKE_HOSP}`);

let chcSmoke = read(SMOKE_HOSP)
  .replaceAll("hospitality", "chc")
  .replaceAll("HOSPITALITY", "CHC")
  .replaceAll("Missing hospitality domain", "Missing chc domain");

writeIfChanged(SMOKE_CHC, chcSmoke.endsWith("\n") ? chcSmoke : chcSmoke + "\n");
chmod755(SMOKE_CHC);
console.log("OK: smoke_authorize_chc.sh updated");

// ------------------------------------------------------------
// 5) Update smoke_list_domains.sh expectation to include chc
// ------------------------------------------------------------
const smokeList = "scripts/smoke_list_domains.sh";
if (!exists(smokeList)) throw new Error(`Missing: ${smokeList}`);

let sld = read(smokeList);
if (!sld.includes(`domains.includes("chc")`)) {
  sld = sld.replace(
    /if\s*\(!domains\.includes\("ciag"\)\s*\|\|\s*!domains\.includes\("hospitality"\)\)\s*\{/m,
    `if (!domains.includes("ciag") || !domains.includes("hospitality") || !domains.includes("chc")) {`
  );
  sld = sld.replaceAll("expected ciag + hospitality", "expected ciag + hospitality + chc");
  writeIfChanged(smokeList, sld);
  chmod755(smokeList);
  console.log("OK: smoke_list_domains.sh now expects chc");
} else {
  console.log("OK: smoke_list_domains.sh already expects chc");
}

// ------------------------------------------------------------
// 6) Update audit_mount_canonical_specs.sh to assert chc and canonical scopes
// ------------------------------------------------------------
const auditMount = "scripts/audit_mount_canonical_specs.sh";
if (!exists(auditMount)) throw new Error(`Missing: ${auditMount}`);

let am = read(auditMount);
if (!am.includes('const chc = r.get("chc");')) {
  am = am.replace(
    /const h = r\.get\("hospitality"\);\s*\nconst c = r\.get\("ciag"\);\s*\n/m,
    `const h = r.get("hospitality");\nconst c = r.get("ciag");\nconst chc = r.get("chc");\n`
  );

  const anchor = 'assert(c.required_scopes?.ESCALATE?.[0] === "ciag:escalate", "ciag ESCALATE scope not canonical");';
  if (!am.includes(anchor)) {
    throw new Error(
      `Invariant: could not locate CIAG ESCALATE assertion anchor in ${auditMount}.\n` +
      `Run: rg -n "ciag ESCALATE scope" ${auditMount} && sed -n '1,220p' ${auditMount}`
    );
  }

  am = am.replace(
    anchor,
    anchor + `

assert(chc, "chc domain missing");
assert(chc.required_scopes?.EXECUTE?.[0] === "chc:execute", "chc EXECUTE scope not canonical");
assert(chc.required_scopes?.ANALYZE?.[0] === "chc:analyze", "chc ANALYZE scope not canonical");
assert(chc.required_scopes?.ESCALATE?.[0] === "chc:escalate", "chc ESCALATE scope not canonical");`
  );

  am = am.replaceAll("hospitality + ciag", "hospitality + ciag + chc");
  writeIfChanged(auditMount, am);
  chmod755(auditMount);
  console.log("OK: audit_mount_canonical_specs.sh now asserts chc");
} else {
  console.log("OK: audit_mount_canonical_specs.sh already asserts chc");
}

console.log("OK: Step 9 CHC executor + mount + smokes repaired.");

// Must end with npm run build
run("npm test");
run("npm run build");
