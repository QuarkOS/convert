import assert from "node:assert/strict";
import test from "node:test";
import { NativeMenu } from "../src/native-menu.ts";

test("the native menu offers jpeg for a png address and skips heic", () => {
  const png = NativeMenu.items().filter((item) => item.patterns.includes("*://*/*/*.png"));
  const titles = png.map((item) => item.title);
  assert.equal(titles.includes(".jpg"), true);
  assert.equal(titles.includes(".webp"), true);
  assert.equal(titles.includes(".heic"), false);
  assert.equal(titles.includes(".mp3"), false);
  const jpg = png.find((item) => item.title === ".jpg");
  assert.ok(jpg);
  assert.deepEqual(NativeMenu.parseItemId(jpg.id), { from: "png", to: "jpg" });
});
