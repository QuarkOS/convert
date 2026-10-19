import { PDFDocument, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";

export class PdfEngine {
  static readonly id = "pdf";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return [
      { from: "txt", to: "pdf" },
      { from: "pdf", to: "txt" },
    ];
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    if (from === "txt" && to === "pdf") return PdfEngine.write(new TextDecoder().decode(input));
    if (from === "pdf" && to === "txt") return new TextEncoder().encode(await PdfEngine.read(input));
    throw new ConversionError("engine-failed", `pdf cannot convert ${from} to ${to}`);
  }

  private static async write(text: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let page = pdf.addPage([612, 792]);
    let y = 740;
    for (const line of text.split(/\r?\n/)) {
      if (y < 72) {
        page = pdf.addPage([612, 792]);
        y = 740;
      }
      const safe = line.replace(/[^\x20-\x7E]/g, "?").slice(0, 90);
      page.drawText(safe, { x: 72, y, size: 12, font });
      y -= 16;
    }
    return pdf.save();
  }

  private static async read(input: Uint8Array): Promise<string> {
    const copy = new Uint8Array(input.byteLength);
    copy.set(input);
    const doc = await getDocument({
      data: copy,
      disableWorker: true,
      verbosity: 0,
      disableFontFace: true,
    } as Parameters<typeof getDocument>[0]).promise;
    const lines: string[] = [];
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join("");
      lines.push(text);
    }
    const joined = lines.join("\n").trim();
    if (!joined) throw new ConversionError("engine-failed", "PDF has no extractable text");
    return `${joined}\n`;
  }
}
