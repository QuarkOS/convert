import { createRequire } from "node:module";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { FirefoxPack } from "./firefox-pack.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreEntry = resolve(root, "../core/src/index.ts");
const dist = resolve(root, "dist");
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#0f6b4c"/>
  <path d="M36 64h48M68 46l18 18-18 18" fill="none" stroke="#f6f3ec" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(root, "icons"), { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(root, "icons", `${size}.png`));
}

const alias = { "@convert/core": coreEntry };
const shared = {
  bundle: true,
  platform: "browser",
  target: ["chrome120", "firefox128"],
  alias,
  absWorkingDir: root,
};

await esbuild.build({
  ...shared,
  entryPoints: ["src/popup.ts", "src/background.ts"],
  format: "esm",
  outdir: "dist",
});

await esbuild.build({
  ...shared,
  entryPoints: ["src/content.ts"],
  format: "iife",
  outfile: "dist/content.js",
});

await cp(resolve(root, "src/popup.html"), resolve(dist, "popup.html"));
await cp(resolve(root, "src/popup.css"), resolve(dist, "popup.css"));
await cp(resolve(root, "src/manifest.json"), resolve(dist, "manifest.json"));
await cp(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });
await FirefoxPack.write(dist, resolve(root, "dist-firefox"));
