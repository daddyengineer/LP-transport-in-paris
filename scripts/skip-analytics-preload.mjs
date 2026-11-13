import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(process.cwd() + "/package.json");
const nextPackage = dirname(require.resolve("next/package.json"));
const files = [
  join(nextPackage, "dist/client/script.js"),
  join(nextPackage, "dist/esm/client/script.js"),
];
const marker = "/* skip analytics preload */";
const needle = "} else if (strategy === 'afterInteractive') {\n            if (src) {";
const replacement = `} else if (strategy === 'afterInteractive') {\n            if (src && !String(src).includes("analytics.kolaborasi.xyz")) { ${marker}`;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (source.includes(marker)) continue;
  if (!source.includes(needle)) {
    console.error(`next/script preload site was not found in ${file}`);
    process.exit(1);
  }
  writeFileSync(file, source.replace(needle, replacement));
}
