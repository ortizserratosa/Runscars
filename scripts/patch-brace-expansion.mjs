import { globSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const marker = "runscars-brace-expansion-commonjs-compat";
const compatibilityPatch = `

// ${marker}
Object.assign(expand, exports);
module.exports = expand;
`;

const packageFiles = globSync("node_modules/**/brace-expansion/package.json", {
  exclude: ["node_modules/**/node_modules/.cache/**"],
});

if (packageFiles.length === 0) {
  throw new Error("No se encontró brace-expansion para aplicar compatibilidad");
}

let patched = 0;
for (const packageFile of packageFiles) {
  const packageJson = JSON.parse(readFileSync(packageFile, "utf8"));
  if (packageJson.version !== "5.0.9") {
    throw new Error(
      `Versión inesperada de brace-expansion: ${packageJson.version}`,
    );
  }
  const commonJsEntry = join(dirname(packageFile), packageJson.main);
  const source = readFileSync(commonJsEntry, "utf8");
  if (!source.includes(marker)) {
    writeFileSync(commonJsEntry, `${source.trimEnd()}${compatibilityPatch}`);
    patched += 1;
  }
}

console.log(
  `Compatibilidad CommonJS de brace-expansion comprobada (${patched} parcheados).`,
);
