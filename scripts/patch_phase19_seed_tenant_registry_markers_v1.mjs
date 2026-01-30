#!/usr/bin/env node
/**
 * Phase 19E — Seed tenant registry marker artifacts
 * Ensures the required marker artifacts exist in:
 *  - data/artifacts.chc.json
 *  - data/artifacts.ciag.json
 *  - data/artifacts.hospitality.json
 *
 * Idempotent. Ends with npm run build.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n"); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const tenants = [
  { tenant: "chc", file: path.join(ROOT, "data", "artifacts.chc.json"), markerId: "TENANT-SEED-CHC" },
  { tenant: "ciag", file: path.join(ROOT, "data", "artifacts.ciag.json"), markerId: "TENANT-SEED-CIAG" },
  { tenant: "hospitality", file: path.join(ROOT, "data", "artifacts.hospitality.json"), markerId: "TENANT-SEED-HOSPITALITY" }
];

let changed = false;

for (const t of tenants) {
  if (!fs.existsSync(t.file)) {
    throw new Error(`Missing tenant registry file: ${t.file}`);
  }

  const j = readJson(t.file);
  if (!j || typeof j !== "object") throw new Error(`Invalid JSON: ${t.file}`);

  j.schema ||= "artifact-registry.seed.v1";
  j.tenant ||= t.tenant;
  j.generatedAt ||= new Date().toISOString();
  j.artifacts ||= [];

  const hasMarker = j.artifacts.some(a => a && (a.id === t.markerId || a.marker === t.markerId));
  if (!hasMarker) {
    j.artifacts.unshift({
      id: t.markerId,
      marker: t.markerId,
      type: "tenant.seed",
      name: `${t.tenant.toUpperCase()} Tenant Seed Marker`,
      createdAt: new Date().toISOString(),
      notes: "Phase 19 smoke contract marker. Do not remove."
    });
    writeJson(t.file, j);
    console.log("Seeded marker:", t.markerId, "->", path.basename(t.file));
    changed = true;
  } else {
    console.log("Marker already present:", t.markerId, "->", path.basename(t.file));
  }
}

if (!changed) {
  console.log("No changes needed; tenant markers already seeded.");
}

console.log("== Running build (required) ==");
run("npm run build");
