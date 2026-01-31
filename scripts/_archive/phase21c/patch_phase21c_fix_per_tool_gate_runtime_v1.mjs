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

const SERVER = "services/mcp-shared-server/server.mjs";
if (!exists(SERVER)) throw new Error("Missing server.mjs");

let src = read(SERVER);

/* ------------------------------------------------------------
 * Insert per-tool minContractVersion enforcement
 * Must occur AFTER tool lookup and BEFORE handler()
 * ---------------------------------------------------------- */

const ANCHOR = "const entry = TOOL_REGISTRY[tool];";
if (!src.includes(ANCHOR)) {
  throw new Error("Unsafe: tool registry anchor not found");
}

const INSERT = `
    // ---- Phase 21C: per-tool minContractVersion gate ----
    if (entry?.minContractVersion) {
      const client = ctx.contractVersion || "0.0.0";
      if (client < entry.minContractVersion) {
        return toolError(
          res,
          409,
          "CONTRACT_VERSION_TOO_LOW",
          "Tool requires newer contractVersion.",
          ctx.traceId,
          {
            tool,
            expected: entry.minContractVersion,
            received: client
          }
        );
      }
    }
`;

if (!src.includes("Phase 21C: per-tool minContractVersion gate")) {
  src = src.replace(ANCHOR, `${ANCHOR}\n${INSERT}`);
}

writeIfChanged(SERVER, src);

console.log("✔ Phase 21C runtime per-tool gate enforced");

console.log("== Running build (required gate) ==");
run("npm run build");
