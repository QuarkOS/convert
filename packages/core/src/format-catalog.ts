import { FORMAT_RECORDS, type FormatFamily, type FormatId, type FormatRecord } from "./domain.ts";

export class FormatCatalog {
  static ids(): readonly FormatId[] {
    return FORMAT_RECORDS.map((record) => record.id);
  }

  static get(id: FormatId): FormatRecord {
    const record = FORMAT_RECORDS.find((item) => item.id === id);
    if (!record) {
      throw new Error(`Unknown format ${id}`);
    }
    return record;
  }

  static family(id: FormatId): FormatFamily {
    return FormatCatalog.get(id).family;
  }

  static extension(id: FormatId): string {
    return FormatCatalog.get(id).extension;
  }

  static mediaType(id: FormatId): string {
    return FormatCatalog.get(id).mediaType;
  }

  static parse(raw: string): FormatId | null {
    const token = raw.trim().toLowerCase().replace(/^\./, "");
    if (!token) return null;
    for (const record of FORMAT_RECORDS) {
      if (record.id === token || record.extension === token || record.mediaType === token) {
        return record.id;
      }
      if ((record.aliases as readonly string[]).includes(token)) return record.id;
    }
    return null;
  }

  static fromFilename(name: string): FormatId | null {
    const base = name.split(/[/\\]/).pop() ?? name;
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) return null;
    return FormatCatalog.parse(base.slice(dot + 1));
  }

  static rename(filename: string, to: FormatId): string {
    const base = filename.split(/[/\\]/).pop() ?? filename;
    const dot = base.lastIndexOf(".");
    const stem = dot > 0 ? base.slice(0, dot) : base;
    return `${stem}.${FormatCatalog.extension(to)}`;
  }
}
