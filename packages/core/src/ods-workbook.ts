import JSZip from "jszip";
import { ConversionError } from "./domain.ts";

export type TableRows = Record<string, string>[];

export class OdsWorkbook {
  static async read(bytes: Uint8Array): Promise<TableRows> {
    const zip = await JSZip.loadAsync(bytes);
    const file = zip.file("content.xml");
    if (!file) throw new ConversionError("engine-failed", "ODS is missing content.xml");
    const xml = await file.async("string");
    const rows = [...xml.matchAll(/<table:table-row\b[\s\S]*?<\/table:table-row>/g)].map((match) => {
      const cells = [...(match[0] ?? "").matchAll(/<table:table-cell\b([^>]*)>([\s\S]*?)<\/table:table-cell>/g)].map((cell) => {
        const attrs = cell[1] ?? "";
        const body = cell[2] ?? "";
        const value = attrs.match(/office:value="([^"]*)"/);
        if (value?.[1] !== undefined) return OdsWorkbook.decode(value[1]);
        const text = body.match(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/);
        return OdsWorkbook.decode((text?.[1] ?? "").replace(/<[^>]+>/g, ""));
      });
      return cells;
    });
    return OdsWorkbook.asRecords(rows);
  }

  static async write(rows: TableRows): Promise<Uint8Array> {
    const headers = OdsWorkbook.headers(rows);
    const body = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
    const xmlRows = body
      .map((row) => {
        const cells = row
          .map((value) => `<table:table-cell office:value-type="string"><text:p>${OdsWorkbook.escape(value)}</text:p></table:table-cell>`)
          .join("");
        return `<table:table-row>${cells}</table:table-row>`;
      })
      .join("");
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet><table:table table:name="Sheet1">${xmlRows}</table:table></office:spreadsheet></office:body></office:document-content>`;
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
    const zip = new JSZip();
    zip.file("mimetype", "application/vnd.oasis.opendocument.spreadsheet", { compression: "STORE" });
    zip.file("content.xml", content);
    zip.file("META-INF/manifest.xml", manifest);
    return zip.generateAsync({ type: "uint8array" });
  }

  static headers(rows: TableRows): string[] {
    const headers: string[] = [];
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (!headers.includes(key)) headers.push(key);
      }
    }
    return headers;
  }

  static asRecords(matrix: string[][]): TableRows {
    const header = matrix[0];
    if (!header || header.length === 0 || header.every((cell) => cell === "")) {
      throw new ConversionError("not-tabular", "Spreadsheet has no header row");
    }
    return matrix.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => {
      const record: Record<string, string> = {};
      header.forEach((key, index) => {
        record[key] = row[index] ?? "";
      });
      return record;
    });
  }

  private static escape(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  private static decode(value: string): string {
    return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
  }
}
