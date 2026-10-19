import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConversionJob, FormatCatalog, type Engine, type FormatId } from "@convert/core";

export type BatchItem =
  | { source: string; output: string; ok: true }
  | { source: string; ok: false; message: string };

export class BatchConvert {
  static async run(input: {
    files: readonly string[];
    to: FormatId;
    engines: readonly Engine[];
  }): Promise<BatchItem[]> {
    const items: BatchItem[] = [];
    for (const source of input.files) {
      items.push(await BatchConvert.one(source, input.to, input.engines));
    }
    return items;
  }

  static outputName(filename: string, to: FormatId): string {
    const renamed = FormatCatalog.rename(filename, to);
    const ext = `.${FormatCatalog.extension(to)}`;
    if (renamed.toLowerCase().endsWith(`${ext}${ext}`)) return renamed;
    return `${renamed}${ext}`;
  }

  static shownName(filename: string): string {
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? filename.slice(0, dot) : filename;
  }

  static outputPath(source: string, to: FormatId): string {
    return path.join(path.dirname(source), BatchConvert.outputName(path.basename(source), to));
  }

  private static async one(source: string, to: FormatId, engines: readonly Engine[]): Promise<BatchItem> {
    const from = FormatCatalog.fromFilename(source);
    if (!from) return { source, ok: false, message: `Convert does not recognize ${path.basename(source)}` };
    if (from === to) return { source, ok: false, message: "The file is already that type" };
    const bytes = new Uint8Array(await readFile(source));
    const result = await ConversionJob.run({ bytes, from, to, engines });
    if (!result.ok) return { source, ok: false, message: result.message };
    const output = BatchConvert.outputPath(source, to);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, result.bytes);
    return { source, output, ok: true };
  }
}
