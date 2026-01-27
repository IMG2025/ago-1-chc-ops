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

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
process.chdir(ROOT);

const EXECUTORS = "src/executors.ts";
if (!exists(EXECUTORS)) throw new Error(`Missing: ${EXECUTORS}`);

let src = read(EXECUTORS);

// We canonicalize within object literal blocks by rewriting `domain_action_scopes: { ... }` values.
// Accepted legacy shapes:
// - "scope:string"
// - ["scope:a", "scope:b"]
// - { EXECUTE:[...], ANALYZE:[...], ESCALATE:[...] }  -> flatten union -> string[]
//
// Canonical output: arrays only, stable sorted, de-duped.

function stableUnique(arr) {
  const out = [];
  const seen = new Set();
  for (const s of arr) {
    if (!seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

function sortScopes(arr) {
  return [...arr].sort((a,b) => a.localeCompare(b));
}

// Best-effort: operate on textual object by parsing just the `domain_action_scopes` JSON-ish fragment.
// We avoid full TS parsing (Termux-friendly) and keep idempotent behavior.
src = src.replace(
  /domain_action_scopes:\s*\{([\s\S]*?)\}\s*,/gm,
  (m, inner) => {
    // Extract top-level entries like: KEY: <value>,
    // NOTE: keys are identifiers, values can be string, array, or object.
    // We'll do a small tokenizer scan on `inner`.
    const text = inner;
    let i = 0;

    function skipWs() { while (i < text.length && /\s/.test(text[i])) i++; }

    function readIdent() {
      skipWs();
      const start = i;
      while (i < text.length && /[A-Z0-9_]/.test(text[i])) i++;
      if (start === i) return null;
      return text.slice(start, i);
    }

    function readValue() {
      skipWs();
      if (text[i] === '"') {
        // string
        i++;
        let s = "";
        while (i < text.length && text[i] !== '"') {
          if (text[i] === "\\") { s += text[i]; i++; if (i < text.length) s += text[i++]; }
          else s += text[i++];
        }
        if (text[i] === '"') i++;
        return { kind: "string", value: JSON.parse(`"${s}"`) };
      }
      if (text[i] === "[") {
        // array literal; we will JSON.parse by extracting balanced brackets
        let depth = 0;
        const start = i;
        while (i < text.length) {
          const ch = text[i++];
          if (ch === "[") depth++;
          else if (ch === "]") { depth--; if (depth === 0) break; }
        }
        const raw = text.slice(start, i);
        // raw should be JSON-ish (double quotes)
        return { kind: "array", value: JSON.parse(raw) };
      }
      if (text[i] === "{") {
        // task-object
        let depth = 0;
        const start = i;
        while (i < text.length) {
          const ch = text[i++];
          if (ch === "{") depth++;
          else if (ch === "}") { depth--; if (depth === 0) break; }
        }
        const raw = text.slice(start, i);
        return { kind: "object", value: JSON.parse(raw) };
      }
      return { kind: "unknown", value: null };
    }

    // Parse entries
    const entries = [];
    while (i < text.length) {
      skipWs();
      if (i >= text.length) break;
      const key = readIdent();
      if (!key) break;
      skipWs();
      if (text[i] !== ":") break;
      i++;
      const val = readValue();
      // consume trailing comma (if any)
      skipWs();
      if (text[i] === ",") i++;
      entries.push([key, val]);
    }

    // If we couldn't parse, don't touch.
    if (entries.length === 0) return m;

    const normalized = [];
    for (const [key, val] of entries) {
      let scopes = [];
      if (val.kind === "string") scopes = [val.value];
      else if (val.kind === "array") scopes = Array.isArray(val.value) ? val.value : [];
      else if (val.kind === "object" && val.value && typeof val.value === "object") {
        for (const k of ["EXECUTE", "ANALYZE", "ESCALATE"]) {
          const arr = val.value[k];
          if (Array.isArray(arr)) scopes.push(...arr);
        }
      } else {
        // unknown: preserve by returning original
        return m;
      }

      scopes = stableUnique(sortScopes(scopes.filter(s => typeof s === "string" && s.length)));
      normalized.push([key, scopes]);
    }

    // Stable output
    normalized.sort((a,b) => a[0].localeCompare(b[0]));

    const outInner =
      normalized
        .map(([k, arr]) => `    ${k}: ${JSON.stringify(arr)},`)
        .join("\n");

    return `domain_action_scopes: {\n${outInner}\n  },`;
  }
);

writeIfChanged(EXECUTORS, src);
console.log("OK: normalized domain_action_scopes to canonical string[] form in src/executors.ts");

// Gates (must end with npm run build)
run("npm test");
run("npm run build");
