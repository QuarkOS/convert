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

test("the explorer menu keeps an image source on image targets", () => {
  const entries = ExplorerMenu.entries(NodeEngines.bundled());
  const png = entries.find((entry) => entry.from === "png");
  const mp4 = entries.find((entry) => entry.from === "mp4");
  const markdown = entries.find((entry) => entry.from === "md");
  assert.ok(png);
  assert.ok(mp4);
  assert.ok(markdown);
  assert.equal(png.targets.includes("jpg"), true);
  assert.equal(png.extensions.includes("png"), true);
  assert.equal(entries.find((entry) => entry.from === "jpg")?.extensions.includes("jpeg"), true);
  assert.equal(png.targets.includes("heic"), false);
  assert.equal(png.targets.includes("mp3"), false);
  assert.equal(png.targets.includes("mp4"), false);
  assert.equal(png.targets.includes("mov"), false);
  assert.equal(png.targets.includes("webm"), false);
  assert.equal(mp4.targets.includes("webm"), true);
  assert.equal(mp4.targets.includes("jpg"), false);
  assert.equal(mp4.targets.includes("png"), false);
  assert.equal(markdown.targets.includes("docx"), true);
  assert.equal(markdown.targets.includes("pdf"), true);
  assert.equal(markdown.targets.includes("mp3"), false);
  const written = BatchConvert.outputName("photo.png", "jpg");
  assert.equal(written, "photo.jpg.jpg");
  assert.notEqual(BatchConvert.shownName("photo.png"), BatchConvert.shownName(written));
});

test("no selection is reported before any conversion", async () => {
  const code = await ConvertHost.main([]);
  assert.equal(code, 2);
});

test("the msix script uses the nuget build tools and does not submit", async () => {
  const script = await readFile(path.join(root, "apps/windows/pack-msix.ps1"), "utf8");
  assert.match(script, /Microsoft\.Windows\.SDK\.BuildTools/);
  assert.match(script, /makeappx\.exe/);
  assert.match(script, /signtool\.exe/);
  assert.match(script, /class ThrowawayCert/);
  assert.match(script, /BouncyCastle\.Cryptography\.dll/);
  assert.equal(script.includes("PartnerCenter"), false);
  assert.equal(script.includes("convertshot"), false);
  assert.equal(script.includes("LoadUserProfile"), false);
  assert.equal(script.includes("/debug"), false);
  const cert = await readFile(path.join(root, "apps/windows/launcher/MemoryCert.cs"), "utf8");
  assert.match(cert, /BasicConstraints\(false\)/);
  assert.match(cert, /KeyUsage\.DigitalSignature/);
  assert.match(cert, /id_kp_codeSigning/);
  assert.match(cert, /Pkcs9AtLocalKeyID/);
  assert.match(cert, /IdAes256Cbc/);
});

test("prove-ship uses the logged-on session and does not invent one", async () => {
  const script = await readFile(path.join(root, "apps/windows/prove-ship.ps1"), "utf8");
  const capture = await readFile(path.join(root, "apps/windows/desktop-capture.ps1"), "utf8");
  assert.match(script, /class InteractiveSession/);
  assert.match(script, /register-menu\.ps1/);
  assert.match(script, /desktop-capture\.ps1/);
  assert.match(script, /pack-msix\.ps1/);
  assert.match(script, /-Sign/);
  assert.match(script, /SCREENSHOT/);
  assert.match(script, /Get-AppxPackage Quack\.Convert/);
  assert.equal(script.includes("convertshot"), false);
  assert.equal(script.includes("mstsc"), false);
  assert.equal(script.includes("fDenyTSConnections"), false);
  assert.equal(script.includes("LoadUserProfile"), false);
  assert.equal(script.includes("New-LocalUser"), false);
  assert.equal(capture.includes("C:\\convertwork"), false);
  assert.equal(capture.includes("convertshot"), false);
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
