import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.16)}" fill="#0f6b4c"/>
  <text x="50%" y="62%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="${Math.round(size * 0.52)}" fill="#f4f1ea">C</text>
</svg>`;

await mkdir(dir, { recursive: true });
await sharp(Buffer.from(svg(50))).png().toFile(path.join(dir, "StoreLogo.png"));
await sharp(Buffer.from(svg(150))).png().toFile(path.join(dir, "Square150x150Logo.png"));
await sharp(Buffer.from(svg(44))).png().toFile(path.join(dir, "Square44x44Logo.png"));
