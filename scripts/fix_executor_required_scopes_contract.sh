#!/usr/bin/env bash
set -euo pipefail

# Find the file that defines ExecutorSpec
FILE=$(grep -R "ExecutorSpec" -l src | head -n 1)

if [ -z "$FILE" ]; then
  echo "ERROR: ExecutorSpec not found in src/"
  exit 1
fi

# IMPORTANT: quoted heredoc prevents bash from expanding $1 / $2 etc.
node - <<'NODE'
import fs from "fs";

const file = process.env.FILE;
if (!file) throw new Error("FILE env var missing");

let s = fs.readFileSync(file, "utf8");

// Replace strict Record with Partial<Record>
s = s.replace(
  /required_scopes\s*:\s*Readonly<\s*Record<([^>]+)>\s*>\s*;/g,
  'required_scopes: Readonly<Partial<Record<$1>>>;'
);

s = s.replace(
  /required_scopes\s*:\s*Record<([^>]+)>\s*;/g,
  'required_scopes: Partial<Record<$1>>;'
);

fs.writeFileSync(file, s);
console.log("Relaxed required_scopes contract in", file);
NODE
