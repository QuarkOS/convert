import assert from "node:assert/strict";
import { mkdtemp, readFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { NodeEngines } from "@convert/core/node";
import { BatchConvert } from "../src/batch-convert.ts";
import { ConvertHost } from "../src/host.ts";
import { ExplorerMenu } from "../src/explorer-menu.ts";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)), "../..");
const png = path.join(root, "packages/core/fixtures/images/red.png");
const manifest = path.join(root, "apps/windows/AppxManifest.xml");

test("two png fixtures become jpeg files in one run", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "convert-win-"));
  const first = path.join(dir, "one.png");
  const second = path.join(dir, "two.png");
  await copyFile(png, first);
  await copyFile(png, second);
  await BatchConvert.run({ files: [first], to: "jpg", engines: NodeEngines.bundled() });
  const started = Date.now();
  const items = await BatchConvert.run({
    files: [first, second],
    to: "jpg",
    engines: NodeEngines.bundled(),
  });
  const elapsed = Date.now() - started;
  assert.equal(items.length, 2);
  assert.ok(elapsed < 15000, `two files took ${elapsed} ms`);
  for (const item of items) {
    assert.equal(item.ok, true);
    if (!item.ok) continue;
    const magic = (await readFile(item.output)).subarray(0, 3);
    assert.deepEqual([...magic], [0xff, 0xd8, 0xff]);
  }
});

test("the explorer menu lists graph targets and skips heic and audio for a png", () => {
  const entries = ExplorerMenu.entries(NodeEngines.bundled());
  const png = entries.find((entry) => entry.from === "png");
  const markdown = entries.find((entry) => entry.from === "md");
  assert.ok(png);
  assert.ok(markdown);
  assert.equal(png.targets.includes("jpg"), true);
  assert.equal(png.extensions.includes("png"), true);
  assert.equal(entries.find((entry) => entry.from === "jpg")?.extensions.includes("jpeg"), true);
  assert.equal(png.targets.includes("heic"), false);
  assert.equal(png.targets.includes("mp3"), false);
  assert.equal(markdown.targets.includes("docx"), true);
  assert.equal(markdown.targets.includes("pdf"), true);
  assert.equal(markdown.targets.includes("mp3"), false);
});

test("no selection is reported before any conversion", async () => {
  const code = await ConvertHost.main([]);
  assert.equal(code, 2);
});

test("the package manifest names Convert and is not a store submission", async () => {
  const xml = await readFile(manifest, "utf8");
  assert.match(xml, /Name="Quack.Convert"/);
  assert.match(xml, /Version="0.1.0.0"/);
  assert.match(xml, /Publisher="CN=Convert"/);
  assert.equal(xml.includes("PartnerCenter"), false);
  assert.equal(xml.includes("store submission"), false);
  for (const name of ["StoreLogo.png", "Square150x150Logo.png", "Square44x44Logo.png"]) {
    const logo = await readFile(path.join(root, "apps/windows/assets", name));
    assert.deepEqual([...logo.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  }
});
