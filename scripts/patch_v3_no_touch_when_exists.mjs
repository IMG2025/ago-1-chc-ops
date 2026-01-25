#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }

const FILE = "scripts/patch_create_sentinel_core_workspace_v3.mjs";
if (!fs.existsSync(FILE)) throw new Error(`Missing ${FILE}`);

let src = fs.readFileSync(FILE, "utf8");

// Idempotency: if already patched, no-op.
if (src.includes("NO_TOUCH_WHEN_SENTINEL_CORE_EXISTS")) {
  console.log("OK: v3 already hardened for no-touch when sentinel-core exists (no-op).");
  run("npm run build");
  process.exit(0);
}

// Anchor: first import block end OR first blank line after imports.
const importAnchor = src.match(/^(import[\s\S]*?\n)\n/m);
if (!importAnchor || importAnchor.index === undefined) {
  throw new Error("Could not locate import block anchor in v3 script.");
}
const insertAt = importAnchor.index + importAnchor[1].length + 1;

const guard = `\n// NO_TOUCH_WHEN_SENTINEL_CORE_EXISTS\n// If sentinel-core already exists, do not rewrite anything inside it.\n// We only run workspace builds as gates.\nimport fs2 from "node:fs";\nconst SENTINEL_CORE_DIR = "packages/sentinel-core";\nif (fs2.existsSync(SENTINEL_CORE_DIR)) {\n  console.log("OK: packages/sentinel-core already exists (no rewrite).");\n  execSync("npm -w @chc/sentinel-core run build", { stdio: "inherit" });\n  execSync("npm run build", { stdio: "inherit" });\n  process.exit(0);\n}\n`;

src = src.slice(0, insertAt) + guard + src.slice(insertAt);

fs.writeFileSync(FILE, src);
console.log("Patched: v3 hardened to no-touch when sentinel-core exists.");

run("npm run build");
