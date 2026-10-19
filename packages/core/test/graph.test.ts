import assert from "node:assert/strict";
import test from "node:test";
import { ConversionJob } from "../src/conversion-job.ts";
import type { FormatId } from "../src/domain.ts";
import { FormatCatalog } from "../src/format-catalog.ts";
import { FormatGraph } from "../src/format-graph.ts";
import { NodeEngines } from "../src/node.ts";

const engines = NodeEngines.host();
const edges = FormatGraph.compile(engines);

function targets(from: FormatId): string[] {
  return FormatGraph.targets(edges, from);
}

test("catalog parses extensions, media types, and aliases", () => {
  assert.equal(FormatCatalog.parse("JPEG"), "jpg");
  assert.equal(FormatCatalog.parse(".HEIF"), "heic");
  assert.equal(FormatCatalog.parse("text/markdown"), "md");
  assert.equal(FormatCatalog.fromFilename("notes/photo.heic"), "heic");
  assert.equal(FormatCatalog.rename("photo.heic", "jpg"), "photo.jpg");
  assert.equal(FormatCatalog.parse("nope"), null);
});

test("still images reach rasters and, through gif, video", () => {
  assert.deepEqual(targets("png"), ["avif", "bmp", "gif", "ico", "jpg", "mov", "mp4", "webm", "webp"]);
  assert.deepEqual(targets("svg"), ["avif", "bmp", "gif", "ico", "jpg", "mov", "mp4", "png", "webm", "webp"]);
  assert.deepEqual(targets("heic"), ["avif", "bmp", "gif", "ico", "jpg", "mov", "mp4", "png", "webm", "webp"]);
  assert.equal(targets("png").includes("heic"), false);
  assert.equal(targets("png").includes("svg"), false);
  assert.equal(targets("png").includes("mp3"), false);
  const svgBmp = FormatGraph.path(edges, "svg", "bmp");
  assert.deepEqual(svgBmp?.map((edge) => edge.to), ["png", "bmp"]);
  const heicJpg = FormatGraph.path(edges, "heic", "jpg");
  assert.deepEqual(heicJpg?.map((edge) => edge.to), ["png", "jpg"]);
});

test("documents, sheets, audio, and video stay in their reachable sets", () => {
  assert.deepEqual(targets("md"), ["docx", "html", "odt", "pdf", "rtf", "txt"]);
  assert.deepEqual(targets("pdf"), ["docx", "html", "md", "odt", "rtf", "txt"]);
  assert.deepEqual(targets("json"), ["csv", "ods", "toml", "xlsx", "xml", "yaml"]);
  assert.deepEqual(targets("mp3"), ["flac", "m4a", "ogg", "wav"]);
  assert.deepEqual(targets("mp4"), ["avif", "bmp", "gif", "ico", "jpg", "mov", "png", "webm", "webp"]);
  assert.equal(FormatGraph.path(edges, "png", "mp3"), null);
  assert.deepEqual(FormatGraph.path(edges, "md", "pdf")?.map((edge) => edge.to), ["txt", "pdf"]);
});

test("same type and unknown pairs return no-path", async () => {
  const same = await ConversionJob.run({ bytes: new Uint8Array([1, 2, 3]), from: "png", to: "png", engines });
  assert.equal(same.ok, false);
  if (!same.ok) assert.equal(same.code, "no-path");
  const cross = await ConversionJob.run({ bytes: new Uint8Array([1, 2, 3]), from: "wav", to: "docx", engines });
  assert.equal(cross.ok, false);
  if (!cross.ok) assert.equal(cross.code, "no-path");
});

test("a JSON object is not a spreadsheet", async () => {
  const bytes = new TextEncoder().encode(`{"title":"ConvertFixture","count":2}\n`);
  const result = await ConversionJob.run({ bytes, from: "json", to: "csv", engines });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "not-tabular");
});

test("bundled engines omit pandoc and still reach docx and pdf", () => {
  const bundled = FormatGraph.compile(NodeEngines.bundled());
  assert.equal(bundled.some((edge) => edge.engineId === "pandoc"), false);
  assert.deepEqual(FormatGraph.targets(bundled, "md"), ["docx", "html", "odt", "pdf", "rtf", "txt"]);
});
