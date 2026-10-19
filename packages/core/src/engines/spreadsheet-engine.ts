import ExcelJS from "exceljs";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";
import { DataEngine } from "./data-engine.ts";
import { OdsWorkbook, type TableRows } from "../ods-workbook.ts";
import { Pairs } from "../pairs.ts";

const SHEETS = ["xlsx", "csv", "ods", "json"] as const satisfies readonly FormatId[];

export class SpreadsheetEngine {
  static readonly id = "spreadsheet";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return Pairs.directed(SHEETS);
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const rows = await SpreadsheetEngine.read(input, from);
    return SpreadsheetEngine.write(rows, to);
  }

  static async read(input: Uint8Array, from: FormatId): Promise<TableRows> {
    if (from === "csv") return SpreadsheetEngine.parseCsv(new TextDecoder().decode(input));
    if (from === "json") return SpreadsheetEngine.rowsFromJson(DataEngine.parse(new TextDecoder().decode(input), "json"));
    if (from === "xlsx") return SpreadsheetEngine.readXlsx(input);
    if (from === "ods") return OdsWorkbook.read(input);
    throw new ConversionError("engine-failed", `spreadsheet cannot read ${from}`);
  }

  static async write(rows: TableRows, to: FormatId): Promise<Uint8Array> {
    if (rows.length === 0) throw new ConversionError("not-tabular", "Spreadsheet has no data rows");
    if (to === "csv") return new TextEncoder().encode(SpreadsheetEngine.toCsv(rows));
    if (to === "json") return new TextEncoder().encode(DataEngine.emit(rows, "json"));
    if (to === "ods") return OdsWorkbook.write(rows);
    if (to === "xlsx") return SpreadsheetEngine.writeXlsx(rows);
    throw new ConversionError("engine-failed", `spreadsheet cannot write ${to}`);
  }

  static rowsFromJson(value: unknown): TableRows {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ConversionError("not-tabular", "JSON is not an array of rows");
    }
    const rows: TableRows = [];
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new ConversionError("not-tabular", "JSON rows must be objects");
      }
      const record: Record<string, string> = {};
      for (const [key, cell] of Object.entries(item)) {
        record[key] = cell == null ? "" : String(cell);
      }
      rows.push(record);
    }
    return rows;
  }

  private static parseCsv(text: string): TableRows {
    const matrix: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    const source = text.replace(/^\uFEFF/, "");
    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (quoted) {
        if (char === '"' && next === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char ?? "";
        }
        continue;
      }
      if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        matrix.push(row);
        row = [];
        cell = "";
      } else if (char !== "\r") {
        cell += char ?? "";
      }
    }
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      matrix.push(row);
    }
    return OdsWorkbook.asRecords(matrix);
  }

  private static toCsv(rows: TableRows): string {
    const headers = OdsWorkbook.headers(rows);
    const lines = [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))];
    return `${lines.map((line) => line.map((value) => SpreadsheetEngine.escapeCsv(value)).join(",")).join("\n")}\n`;
  }

  private static escapeCsv(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
    return value;
  }

  private static async readXlsx(input: Uint8Array): Promise<TableRows> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(input));
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new ConversionError("not-tabular", "Workbook has no sheet");
    const matrix: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values;
      const cells = Array.isArray(values) ? values.slice(1) : [];
      matrix.push(cells.map((cell) => SpreadsheetEngine.cellText(cell)));
    });
    return OdsWorkbook.asRecords(matrix);
  }

  private static cellText(cell: unknown): string {
    if (cell == null) return "";
    if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return String(cell);
    if (cell instanceof Date) return cell.toISOString();
    if (typeof cell === "object" && "text" in cell && typeof cell.text === "string") return cell.text;
    if (typeof cell === "object" && "result" in cell) return SpreadsheetEngine.cellText(cell.result);
    return "";
  }

  private static async writeXlsx(rows: TableRows): Promise<Uint8Array> {
    const headers = OdsWorkbook.headers(rows);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(headers);
    for (const row of rows) sheet.addRow(headers.map((header) => row[header] ?? ""));
    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }
}
