import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { ConversionJob } from "../src/conversion-job.ts";
import type { FormatId } from "../src/domain.ts";
import { FormatGraph } from "../src/format-graph.ts";
import { NodeEngines } from "../src/node.ts";
import { OfficeEngine } from "../src/engines/office-engine.ts";
import { OutputProbe, readFixture } from "./output-probe.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const engines = NodeEngines.host();
const edges = FormatGraph.compile(engines);
const phrase = "ConvertFixture";

const files: Record<FormatId, string> = {
  png: "images/red.png",
  jpg: "images/red.jpg",
  webp: "images/red.webp",
  avif: "images/red.avif",
  gif: "images/red.gif",
  bmp: "images/red.bmp",
  ico: "images/red.ico",
  svg: "images/red.svg",
  heic: "images/sample.heic",
  docx: "documents/note.docx",
  pdf: "documents/note.pdf",
  md: "documents/note.md",
  html: "documents/note.html",
  txt: "documents/note.txt",
  odt: "documents/note.odt",
  rtf: "documents/note.rtf",
  xlsx: "sheets/rows.xlsx",
  csv: "sheets/rows.csv",
  ods: "sheets/rows.ods",
  json: "sheets/rows.json",
  yaml: "data/object.yaml",
  xml: "data/object.xml",
  toml: "data/object.toml",
  mp3: "audio/tone.mp3",
  wav: "audio/tone.wav",
  flac: "audio/tone.flac",
  ogg: "audio/tone.ogg",
  m4a: "audio/tone.m4a",
  mp4: "video/clip.mp4",
  webm: "video/clip.webm",
  mov: "video/clip.mov",
};

const redSources = new Set<FormatId>(["png", "jpg", "webp", "avif", "gif", "bmp", "ico", "svg"]);
const phraseSources = new Set<FormatId>([
  "docx",
  "pdf",
  "md",
  "html",
  "txt",
  "odt",
  "rtf",
  "xlsx",
  "csv",
  "ods",
  "json",
  "yaml",
  "xml",
  "toml",
]);
const sheetTargets = new Set<FormatId>(["csv", "xlsx", "ods"]);
const objectData = new Set<FormatId>(["yaml", "xml", "toml"]);

test("every offered target produces a valid file", async () => {
  const failures: string[] = [];
  for (const from of Object.keys(files) as FormatId[]) {
    const bytes = await readFixture(join(root, files[from]));
    for (const to of FormatGraph.targets(edges, from)) {
      const started = Date.now();
      const result = await ConversionJob.run({ bytes, from, to, engines });
      const contentDependent = objectData.has(from) && sheetTargets.has(to);
      if (contentDependent) {
        assert.equal(result.ok, false, `${from}->${to} should reject a non-tabular object`);
        if (!result.ok) assert.equal(result.code, "not-tabular");
        continue;
      }
      if (!result.ok) {
        failures.push(`${from}->${to} ${result.code} ${result.message}`);
        continue;
      }
      try {
        await OutputProbe.assertFile(to, result.bytes, {
          red: redSources.has(from) && ["png", "jpg", "webp", "avif", "gif", "bmp", "ico"].includes(to),
          phrase: phraseSources.has(from) && phraseSources.has(to),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${from}->${to} invalid: ${message}`);
      }
      if (from === "png" && to === "jpg") {
        const elapsed = Date.now() - started;
        assert.ok(elapsed < 2000, `png to jpg took ${elapsed}ms`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("office engine preserves the fixture phrase without pandoc", async () => {
  const md = await readFixture(join(root, files.md));
  const docx = await OfficeEngine.convert(md, "md", "docx");
  const text = await OfficeEngine.read(docx, "docx");
  assert.ok(text.includes(phrase));
  const bundled = NodeEngines.bundled();
  const pdf = await ConversionJob.run({ bytes: md, from: "md", to: "pdf", engines: bundled });
  assert.equal(pdf.ok, true);
  if (pdf.ok) await OutputProbe.assertFile("pdf", pdf.bytes, { phrase: true });
});

test("a yaml array of rows becomes a csv", async () => {
  const yaml = new TextEncoder().encode("- name: ConvertFixture\n  note: ok\n");
  const result = await ConversionJob.run({ bytes: yaml, from: "yaml", to: "csv", engines });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(new TextDecoder().decode(result.bytes).includes(phrase));
    assert.deepEqual(result.steps, ["yaml", "json", "csv"]);
  }
});
