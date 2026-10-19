import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import type { FormatId } from "../src/domain.ts";

const PHRASE = "ConvertFixture";

export class OutputProbe {
  static async assertFile(format: FormatId, bytes: Uint8Array, expect: { red?: boolean; phrase?: boolean }) {
    assert.ok(bytes.byteLength > 8, `${format} output is empty`);
    if (format === "png") OutputProbe.magic(bytes, [0x89, 0x50, 0x4e, 0x47], format);
    if (format === "jpg") OutputProbe.magic(bytes, [0xff, 0xd8, 0xff], format);
    if (format === "gif") assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), "GIF8");
    if (format === "webp") {
      assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), "RIFF");
      assert.equal(Buffer.from(bytes.subarray(8, 12)).toString("ascii"), "WEBP");
    }
    if (format === "avif" || format === "mp4" || format === "mov" || format === "m4a") {
      assert.equal(Buffer.from(bytes.subarray(4, 8)).toString("ascii"), "ftyp", format);
    }
    if (format === "bmp") OutputProbe.magic(bytes, [0x42, 0x4d], format);
    if (format === "ico") {
      assert.equal(bytes[0], 0);
      assert.equal(bytes[2], 1);
    }
    if (format === "pdf") assert.equal(Buffer.from(bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
    if (format === "rtf") assert.ok(Buffer.from(bytes.subarray(0, 5)).toString("ascii").startsWith("{\\rtf") || bytes[0] === 0x7b);
    if (format === "wav") assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), "RIFF");
    if (format === "flac") assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), "fLaC");
    if (format === "ogg") assert.equal(Buffer.from(bytes.subarray(0, 4)).toString("ascii"), "OggS");
    if (format === "webm") OutputProbe.magic(bytes, [0x1a, 0x45, 0xdf, 0xa3], format);
    if (format === "docx" || format === "xlsx" || format === "odt" || format === "ods") {
      OutputProbe.magic(bytes, [0x50, 0x4b], format);
    }

    if (expect.phrase) {
      const text = await OutputProbe.textOf(format, bytes);
      assert.ok(text.includes(PHRASE), `${format} text missing ${PHRASE}: ${text.slice(0, 180)}`);
    }
    if (expect.red) {
      const pixel = await OutputProbe.firstPixel(format, bytes);
      assert.ok(pixel.r > 120 && pixel.g < 100 && pixel.b < 110, `${format} pixel ${pixel.r},${pixel.g},${pixel.b} is not the red fixture`);
    }
    if (format === "mp3" || format === "wav" || format === "flac" || format === "ogg" || format === "m4a") {
      const info = await OutputProbe.ffprobe(bytes, format);
      assert.ok(info.includes("audio"), `${format} ffprobe has no audio stream: ${info}`);
    }
    if (format === "mp4" || format === "webm" || format === "mov") {
      const info = await OutputProbe.ffprobe(bytes, format);
      assert.ok(info.includes("video"), `${format} ffprobe has no video stream: ${info}`);
    }
  }

  private static magic(bytes: Uint8Array, expected: number[], format: string) {
    for (let index = 0; index < expected.length; index += 1) {
      assert.equal(bytes[index], expected[index], `${format} magic mismatch at ${index}`);
    }
  }

  private static async textOf(format: FormatId, bytes: Uint8Array): Promise<string> {
    if (format === "pdf") return OutputProbe.commandText("pdftotext", bytes, format, ["-"]);
    if (format === "docx") return OutputProbe.zipText(bytes, "word/document.xml");
    if (format === "odt" || format === "ods") return OutputProbe.zipText(bytes, "content.xml");
    if (format === "xlsx") return OutputProbe.zipText(bytes, "xl/sharedStrings.xml");
    return new TextDecoder().decode(bytes);
  }

  private static async zipText(bytes: Uint8Array, entry: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "zip-"));
    try {
      const path = join(dir, "file.bin");
      await writeFile(path, bytes);
      return execFileSync("python3", ["-c", `import zipfile; print(zipfile.ZipFile(${JSON.stringify(path)}).read(${JSON.stringify(entry)}).decode("utf-8","replace"))`], {
        encoding: "utf8",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private static async commandText(command: string, bytes: Uint8Array, format: string, args: string[]): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "probe-"));
    try {
      const path = join(dir, `file.${format}`);
      await writeFile(path, bytes);
      return execFileSync(command, [path, ...args], { encoding: "utf8" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private static async firstPixel(format: FormatId, bytes: Uint8Array): Promise<{ r: number; g: number; b: number }> {
    const dir = await mkdtemp(join(tmpdir(), "pix-"));
    try {
      const path = join(dir, `file.${format}`);
      await writeFile(path, bytes);
      const raw = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], {
        maxBuffer: 8_000_000,
      });
      return { r: raw[0] ?? 0, g: raw[1] ?? 0, b: raw[2] ?? 0 };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private static async ffprobe(bytes: Uint8Array, format: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "probe-"));
    try {
      const path = join(dir, `file.${format}`);
      await writeFile(path, bytes);
      return execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", path], {
        encoding: "utf8",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

export async function readFixture(path: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path));
}
