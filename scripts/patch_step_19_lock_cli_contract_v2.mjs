#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}
function chmod755(p) { try { fs.chmodSync(p, 0o755); } catch {} }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const PKG = "package.json";
if (!exists(PKG)) throw new Error("Missing: package.json");

const BROKEN_PATCH = "scripts/patch_step_19_lock_cli_contract_v1.mjs";
if (exists(BROKEN_PATCH)) {
  const stub =
    [
      "#!/usr/bin/env node",
      "/**",
      " * DEPRECATED/BROKEN: v1 embedded Bash ${...} inside a JS template literal (backticks), which breaks JS parsing.",
      " * Use scripts/patch_step_19_lock_cli_contract_v2.mjs instead.",
      " */",
      'import { execSync } from "node:child_process";',
      'execSync("npm test", { stdio: "inherit" });',
      'execSync("npm run build", { stdio: "inherit" });',
      "",
    ].join("\n");
  writeIfChanged(BROKEN_PATCH, stub);
  chmod755(BROKEN_PATCH);
  console.log("OK: stubbed broken patch_step_19_lock_cli_contract_v1.mjs");
}

const AUDIT = "scripts/audit_cli_contract_v1.sh";

// NOTE: Use array-join (no JS backticks) to avoid ${...} interpolation landmines.
const auditSrc =
  [
    "#!/usr/bin/env bash",
    "set -euo pipefail",
    "",
    'ROOT="$(git rev-parse --show-toplevel)"',
    'cd "$ROOT"',
    "",
    "npm run build >/dev/null",
    "",
    "# 1) Dist entrypoints must be importable (runtime contract)",
    "node - <<'NODE'",
    "async function main() {",
    "  try {",
    '    await import("./dist/index.js");',
    "  } catch (e) {",
    '    console.error("FAIL: dist/index.js import failed");',
    "    console.error(String((e && e.stack) || e));",
    "    process.exit(1);",
    "  }",
    "  try {",
    '    await import("./dist/registry.js");',
    "  } catch (e) {",
    '    console.error("FAIL: dist/registry.js import failed");',
    "    console.error(String((e && e.stack) || e));",
    "    process.exit(1);",
    "  }",
    '  console.log("OK: dist entrypoints importable");',
    "}",
    "main();",
    "NODE",
    "",
    "# 2) If package.json defines bin(s), each bin path exists and --help runs (exit 0) and emits non-empty output",
    'bins="$(node - <<\'NODE\'',
    'import fs from "node:fs";',
    'const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));',
    "const bin = pkg.bin;",
    "",
    "function emit(name, p) {",
    '  if (typeof p === "string" && p.length) console.log(name + "\\t" + p);',
    "}",
    "",
    'if (typeof bin === "string") emit(pkg.name || "bin", bin);',
    'else if (bin && typeof bin === "object") {',
    "  for (const [k, v] of Object.entries(bin)) emit(k, v);",
    "}",
    "NODE",
    ')"',
    "",
    'if [[ -z "$bins" ]]; then',
    '  echo "OK: no package.json bin defined; CLI contract limited to dist importability"',
    "  exit 0",
    "fi",
    "",
    "failed=0",
    'NAMES=""',
    "while IFS=$'\\t' read -r name path; do",
    '  [[ -n "$name" ]] || continue',
    '  [[ -n "$path" ]] || continue',
    '  if [[ -z "$NAMES" ]]; then NAMES="$name"; else NAMES="$NAMES,$name"; fi',
    "",
    '  if [[ ! -f "$path" ]]; then',
    '    echo "FAIL: bin path missing for $name: $path"',
    "    failed=1",
    "    continue",
    "  fi",
    "",
    '  out="$(node "$path" --help 2>&1 || true)"',
    '  if [[ -z "$out" ]]; then',
    '    echo "FAIL: $name --help produced empty output ($path)"',
    "    failed=1",
    "    continue",
    "  fi",
    "",
    '  node "$path" --help >/dev/null 2>&1 || { echo "FAIL: $name --help exited non-zero ($path)"; failed=1; }',
    "done <<< \"$bins\"",
    "",
    'if [[ "$failed" -ne 0 ]]; then',
    "  exit 1",
    "fi",
    'echo "OK: CLI bin contract locked for: $NAMES"',
    "",
  ].join("\n");

writeIfChanged(AUDIT, auditSrc);
chmod755(AUDIT);
console.log("OK: wrote " + AUDIT);

// Wire into npm test (idempotent) — prefer after authorization contract audit, else after registry contract
const pkg = JSON.parse(read(PKG));
const t = pkg.scripts?.test;
if (typeof t !== "string") throw new Error("Invariant: scripts.test missing or not a string.");

if (!t.includes("./scripts/audit_cli_contract_v1.sh")) {
  let next = t;

  if (next.includes("./scripts/audit_authorization_contract_v1.sh")) {
    next = next.replace(
      "./scripts/audit_authorization_contract_v1.sh",
      "./scripts/audit_authorization_contract_v1.sh && ./scripts/audit_cli_contract_v1.sh"
    );
  } else if (next.includes("./scripts/audit_registry_contract_v1.sh")) {
    next = next.replace(
      "./scripts/audit_registry_contract_v1.sh",
      "./scripts/audit_registry_contract_v1.sh && ./scripts/audit_cli_contract_v1.sh"
    );
  } else {
    next = next + " && ./scripts/audit_cli_contract_v1.sh";
  }

  pkg.scripts.test = next;
  writeIfChanged(PKG, JSON.stringify(pkg, null, 2) + "\n");
  console.log("OK: wired CLI contract audit into npm test");
} else {
  console.log("OK: CLI contract audit already wired into npm test");
}

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
