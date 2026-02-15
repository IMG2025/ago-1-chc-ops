#!/usr/bin/env node
import fs from "node:fs";

const file = "src/index.ts";
const content = fs.readFileSync(file, "utf8");

// Comment out the problematic line
const fixed = content.replace(
  'export { registerCIAG } from "ciag-ago-1";',
  '// export { registerCIAG } from "ciag-ago-1";  // TODO: Re-enable when ciag-ago-1 is published'
);

fs.writeFileSync(file, fixed);
console.log("Fixed ciag-ago-1 import in src/index.ts");
