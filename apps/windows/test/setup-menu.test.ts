import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { NodeEngines } from "@convert/core/node";
import { ExplorerMenu } from "../src/explorer-menu.ts";
import { SetupMenu } from "../src/setup-menu.ts";

const windows = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

test("the installer menu keeps an image on image targets and quotes one command", () => {
  const entries = ExplorerMenu.entries(NodeEngines.bundled());
  const install = SetupMenu.install(entries);
  const png = SetupMenu.block(install, "png");
  assert.match(png, /MUIVerb" "Convert to"/);
  assert.match(png, /shell\\jpg/);
  assert.match(png, /--to jpg/);
  assert.equal(png.includes("shell\\mp4"), false);
  assert.equal(png.includes("shell\\mov"), false);
  assert.equal(png.includes("shell\\webm"), false);
  const mp4 = SetupMenu.block(install, "mp4");
  assert.match(mp4, /shell\\webm/);
  assert.equal(mp4.includes("shell\\jpg"), false);
  const uninstall = SetupMenu.uninstall(entries);
  assert.match(uninstall, /DeleteRegKey HKCU "Software\\Classes\\SystemFileAssociations\\\.png\\shell\\ConvertTo"/);
  assert.match(install, /\$\\"\$INSTDIR\\Convert\.cmd\$\\" --to jpg/);
});

test("the release tree does not revive the remote desktop prove path", async () => {
  const names = await readdir(windows);
  assert.equal(names.includes("prove-ship.ps1"), false);
  for (const name of names) {
    if (!name.endsWith(".ps1")) continue;
    const text = await readFile(path.join(windows, name), "utf8");
    assert.equal(text.includes("convertshot"), false, name);
    assert.equal(text.includes("mstsc"), false, name);
    assert.equal(text.includes("fDenyTSConnections"), false, name);
  }
});
