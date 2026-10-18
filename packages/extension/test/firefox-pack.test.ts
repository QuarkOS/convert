import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { FirefoxPack } from "../scripts/firefox-pack.ts";

test("firefox pack replaces the service worker with background scripts", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "convert-ff-"));
  const source = path.join(dir, "ext");
  const target = path.join(dir, "firefox");
  await mkdir(source);
  await writeFile(
    path.join(source, "manifest.json"),
    JSON.stringify({ background: { service_worker: "background.js", type: "module" } }),
  );
  await writeFile(path.join(source, "background.js"), "/* bundled */\n");
  await FirefoxPack.write(source, target);
  const manifest = JSON.parse(await readFile(path.join(target, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.background, { scripts: ["background.js"] });
  assert.equal(await readFile(path.join(target, "background.js"), "utf8"), "/* bundled */\n");
});
