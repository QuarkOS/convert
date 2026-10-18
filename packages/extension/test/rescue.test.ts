import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ConversionJob, FormatCatalog, FormatGraph } from "@convert/core";
import { CanvasRasterEngine } from "../src/canvas-raster.ts";
import { PopupEngines } from "../src/popup-engines.ts";
import { RescuePolicy } from "../src/rescue.ts";

const here = dirname(fileURLToPath(import.meta.url));
const pages = join(here, "../fixtures/pages");
const fixtures = join(here, "../../core/fixtures");

function imageTargets(filename: string): ReturnType<typeof FormatGraph.targets> {
  const from = FormatCatalog.fromFilename(filename);
  if (!from) return [];
  const engine = {
    id: CanvasRasterEngine.id,
    available: () => true,
    edges: () => CanvasRasterEngine.edges(),
    convert: async () => new Uint8Array(),
  };
  return FormatGraph.targets(FormatGraph.compile([engine]), from);
}

test("accept fixture offers only jpeg and png for a webp", () => {
  const html = readFileSync(join(pages, "accept.html"), "utf8");
  const accept = html.match(/accept="([^"]+)"/)?.[1];
  assert.ok(accept);
  assert.match(html, /id="photo"/);
  const decision = RescuePolicy.fromAccept({
    filename: "photo.webp",
    accept,
    hintText: "JPG or PNG only",
    enabled: true,
    targets: imageTargets("photo.webp"),
  });
  assert.equal(decision.show, true);
  assert.deepEqual(decision.targets, ["jpg", "png"]);
  assert.match(decision.message, /doesn't accept \.webp, convert to \.jpg/);
});

test("rejection fixture toast follows the alert text", () => {
  const html = readFileSync(join(pages, "reject.html"), "utf8");
  assert.match(html, /role="alert"/);
  const phrase = html.match(/alert\.textContent = "([^"]+)"/)?.[1];
  assert.equal(phrase, "Unsupported file type. Use .jpg or .png.");
  const decision = RescuePolicy.fromRejection({
    filename: "photo.webp",
    accept: "",
    hintText: "",
    alertText: phrase,
    enabled: true,
    targets: imageTargets("photo.webp"),
  });
  assert.equal(decision.show, true);
  assert.deepEqual(decision.targets, ["jpg", "png"]);
});

test("a disabled origin and a non type error stay quiet", () => {
  const targets = imageTargets("photo.webp");
  const muted = RescuePolicy.fromAccept({
    filename: "photo.webp",
    accept: ".jpg,.png",
    hintText: "",
    enabled: false,
    targets,
  });
  assert.equal(muted.show, false);
  const size = RescuePolicy.fromRejection({
    filename: "photo.webp",
    accept: "",
    hintText: "",
    alertText: "File is larger than 2 MB",
    enabled: true,
    targets,
  });
  assert.equal(size.show, false);
});

test("popup engines keep a markdown phrase through pdf without pandoc", async () => {
  const markdown = readFileSync(join(fixtures, "documents/note.md"));
  const result = await ConversionJob.run({
    bytes: markdown,
    from: "md",
    to: "pdf",
    engines: PopupEngines.list(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.bytes[0], 0x25);
  assert.equal(result.steps.join(","), "md,txt,pdf");
});

test("a csv fixture becomes json rows", async () => {
  const csv = readFileSync(join(fixtures, "sheets/rows.csv"));
  const result = await ConversionJob.run({
    bytes: csv,
    from: "csv",
    to: "json",
    engines: PopupEngines.list(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(new TextDecoder().decode(result.bytes), /ConvertFixture/);
});
