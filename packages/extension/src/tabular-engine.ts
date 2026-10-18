import { ConversionError, type FormatId } from "../../core/src/domain.ts";
import { DataEngine } from "../../core/src/engines/data-engine.ts";
import { OdsWorkbook } from "../../core/src/ods-workbook.ts";

type TableRows = Record<string, string>[];

const SHEETS = ["csv", "json", "ods"] as const satisfies readonly FormatId[];

export class TabularEngine {
  static readonly id = "tabular";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    const edges: { from: FormatId; to: FormatId }[] = [];
    for (const from of SHEETS) {
      for (const to of SHEETS) {
        if (from !== to) edges.push({ from, to });
      }
    }
    return edges;
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const rows = await TabularEngine.read(input, from);
    return TabularEngine.write(rows, to);
  }

  private static async read(input: Uint8Array, from: FormatId): Promise<TableRows> {
    if (from === "csv") return TabularEngine.parseCsv(new TextDecoder().decode(input));
    if (from === "json") return TabularEngine.rowsFromJson(DataEngine.parse(new TextDecoder().decode(input), "json"));
    if (from === "ods") return OdsWorkbook.read(input);
    throw new ConversionError("engine-failed", `tabular cannot read ${from}`);
  }

  private static async write(rows: TableRows, to: FormatId): Promise<Uint8Array> {
    if (rows.length === 0) throw new ConversionError("not-tabular", "Spreadsheet has no data rows");
    if (to === "csv") return new TextEncoder().encode(TabularEngine.toCsv(rows));
    if (to === "json") return new TextEncoder().encode(DataEngine.emit(rows, "json"));
    if (to === "ods") return OdsWorkbook.write(rows);
    throw new ConversionError("engine-failed", `tabular cannot write ${to}`);
  }

  private static rowsFromJson(value: unknown): TableRows {
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
      if (char === '"') quoted = true;
      else if (char === ",") {
        row.push(cell);
        cell = "";
      } else if (char === "\n") {
        row.push(cell);
        matrix.push(row);
        row = [];
        cell = "";
      } else if (char !== "\r") cell += char ?? "";
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
    return `${lines.map((line) => line.map((value) => TabularEngine.escapeCsv(value)).join(",")).join("\n")}\n`;
  }

  private static escapeCsv(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
    return value;
  }
}
