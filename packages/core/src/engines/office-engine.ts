import JSZip from "jszip";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";
import { Pairs } from "../pairs.ts";

const DOCS = ["docx", "md", "html", "txt", "odt", "rtf"] as const satisfies readonly FormatId[];

export class OfficeEngine {
  static readonly id = "office";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return Pairs.directed(DOCS);
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const text = await OfficeEngine.read(input, from);
    return OfficeEngine.write(text, to);
  }

  static async read(input: Uint8Array, from: FormatId): Promise<string> {
    if (from === "txt" || from === "md") return OfficeEngine.decode(input);
    if (from === "html") return OfficeEngine.htmlToText(OfficeEngine.decode(input));
    if (from === "rtf") return OfficeEngine.rtfToText(OfficeEngine.decode(input));
    if (from === "docx") return OfficeEngine.docxToText(input);
    if (from === "odt") return OfficeEngine.odtToText(input);
    throw new ConversionError("engine-failed", `office cannot read ${from}`);
  }

  static async write(text: string, to: FormatId): Promise<Uint8Array> {
    if (to === "txt" || to === "md") return OfficeEngine.encode(text.endsWith("\n") ? text : `${text}\n`);
    if (to === "html") return OfficeEngine.encode(OfficeEngine.textToHtml(text));
    if (to === "rtf") return OfficeEngine.encode(OfficeEngine.textToRtf(text));
    if (to === "docx") return OfficeEngine.textToDocx(text);
    if (to === "odt") return OfficeEngine.textToOdt(text);
    throw new ConversionError("engine-failed", `office cannot write ${to}`);
  }

  private static decode(input: Uint8Array): string {
    return new TextDecoder().decode(input);
  }

  private static encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }

  private static htmlToText(html: string): string {
    return OfficeEngine.decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private static textToHtml(text: string): string {
    const paragraphs = text.split(/\r?\n/).map((line) => `<p>${OfficeEngine.escape(line)}</p>`);
    return `<!DOCTYPE html><html><body>${paragraphs.join("")}</body></html>\n`;
  }

  private static textToRtf(text: string): string {
    const body = text
      .replaceAll("\\", "\\\\")
      .replaceAll("{", "\\{")
      .replaceAll("}", "\\}")
      .replace(/\r?\n/g, "\\par\n");
    return `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\pard ${body}\\par}\n`;
  }

  private static rtfToText(rtf: string): string {
    return rtf
      .replace(/\\'[0-9a-fA-F]{2}/g, " ")
      .replace(/\\par[d]?/g, "\n")
      .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
      .replace(/\\([\\{}])/g, "$1")
      .replace(/[{}]/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
  }

  private static async docxToText(input: Uint8Array): Promise<string> {
    const zip = await JSZip.loadAsync(input);
    const file = zip.file("word/document.xml");
    if (!file) throw new ConversionError("engine-failed", "DOCX is missing word/document.xml");
    const xml = await file.async("string");
    const paragraphs = xml.split(/<w:p[\s>]/).slice(1);
    const lines = paragraphs.map((paragraph) => {
      const parts = [...paragraph.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((match) => OfficeEngine.decodeEntities(match[1] ?? ""));
      return parts.join("");
    });
    return lines.join("\n").trim();
  }

  private static async textToDocx(text: string): Promise<Uint8Array> {
    const paragraphs = text.split(/\r?\n/).map((line) => `<w:p><w:r><w:t xml:space="preserve">${OfficeEngine.escape(line)}</w:t></w:r></w:p>`);
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs.join("")}<w:sectPr/></w:body></w:document>`;
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    );
    zip.file("word/document.xml", document);
    return zip.generateAsync({ type: "uint8array" });
  }

  private static async odtToText(input: Uint8Array): Promise<string> {
    const zip = await JSZip.loadAsync(input);
    const file = zip.file("content.xml");
    if (!file) throw new ConversionError("engine-failed", "ODT is missing content.xml");
    const xml = await file.async("string");
    const lines = [...xml.matchAll(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/g)].map((match) =>
      OfficeEngine.decodeEntities((match[1] ?? "").replace(/<[^>]+>/g, "")),
    );
    return lines.join("\n").trim();
  }

  private static async textToOdt(text: string): Promise<Uint8Array> {
    const paragraphs = text
      .split(/\r?\n/)
      .map((line) => `<text:p>${OfficeEngine.escape(line)}</text:p>`)
      .join("");
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${paragraphs}</office:text></office:body></office:document-content>`;
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
    const zip = new JSZip();
    zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
    zip.file("content.xml", content);
    zip.file("META-INF/manifest.xml", manifest);
    return zip.generateAsync({ type: "uint8array" });
  }

  private static escape(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  private static decodeEntities(value: string): string {
    return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replaceAll("&quot;", '"');
  }
}
