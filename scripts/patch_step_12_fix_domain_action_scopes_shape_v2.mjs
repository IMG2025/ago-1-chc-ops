#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function exists(p) { return fs.existsSync(p); }
function writeIfChanged(p, next) {
  const prev = exists(p) ? read(p) : "";
  if (prev !== next) fs.writeFileSync(p, next);
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const SCHEMA_PATH = path.join("schemas", "executor.spec.schema.json");
if (!exists(SCHEMA_PATH)) throw new Error(`Missing: ${SCHEMA_PATH}`);

let schema;
try { schema = JSON.parse(read(SCHEMA_PATH)); }
catch { throw new Error(`Invariant: invalid JSON in ${SCHEMA_PATH}`); }

// Idempotent upgrade: ensure domain_action_scopes.additionalProperties uses a union type
schema.properties = schema.properties ?? {};
schema.properties.domain_action_scopes = schema.properties.domain_action_scopes ?? { type: "object" };

const actionScopeTaskObj = {
  type: "object",
  additionalProperties: false,
  properties: {
    EXECUTE: { type: "array", items: { type: "string", minLength: 1 } },
    ANALYZE: { type: "array", items: { type: "string", minLength: 1 } },
    ESCALATE: { type: "array", items: { type: "string", minLength: 1 } }
  }
};

const actionScopeArray = { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 };
const actionScopeString = { type: "string", minLength: 1 };

// Canonical union: prefer array, allow string (legacy), allow task-object (advanced)
schema.properties.domain_action_scopes.additionalProperties = {
  anyOf: [actionScopeArray, actionScopeString, actionScopeTaskObj]
};

writeIfChanged(SCHEMA_PATH, JSON.stringify(schema, null, 2) + "\n");
console.log("OK: widened executor spec schema: domain_action_scopes values now allow string | string[] | {EXECUTE/ANALYZE/ESCALATE}.");

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
