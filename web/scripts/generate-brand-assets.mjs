import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webDirectory = path.resolve(scriptDirectory, "..");
const source = path.join(webDirectory, "public", "runscars-social-v1.svg");
const target = path.join(webDirectory, "public", "runscars-social-v1.png");

const svg = await readFile(source);
await sharp(svg).png({ compressionLevel: 9 }).toFile(target);

console.log(`Generated ${path.relative(webDirectory, target)}`);
