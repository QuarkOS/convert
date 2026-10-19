import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";
import { Pairs } from "../pairs.ts";

const DATA = ["json", "yaml", "xml", "toml"] as const satisfies readonly FormatId[];

export class DataEngine {
  static readonly id = "data";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return Pairs.directed(DATA);
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const value = DataEngine.parse(new TextDecoder().decode(input), from);
    return new TextEncoder().encode(DataEngine.emit(value, to));
  }

  static parse(text: string, from: FormatId): unknown {
    try {
      if (from === "json") return JSON.parse(text) as unknown;
      if (from === "yaml") return parseYaml(text);
      if (from === "xml") return DataEngine.fromXml(text);
      if (from === "toml") return DataEngine.fromToml(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : "parse failed";
      throw new ConversionError("engine-failed", `${from} parse failed. ${message}`);
    }
    throw new ConversionError("engine-failed", `data cannot read ${from}`);
  }

  static emit(value: unknown, to: FormatId): string {
    if (to === "json") return `${JSON.stringify(value, null, 2)}\n`;
    if (to === "yaml") return stringifyYaml(value);
    if (to === "xml") return DataEngine.toXml(value);
    if (to === "toml") return DataEngine.toToml(value);
    throw new ConversionError("engine-failed", `data cannot write ${to}`);
  }

  private static fromXml(text: string): unknown {
    const parser = new XMLParser({ ignoreAttributes: true });
    const parsed = parser.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || !("data" in parsed)) {
      throw new ConversionError("engine-failed", "XML is missing a data root");
    }
    return (parsed as { data: unknown }).data;
  }

  private static toXml(value: unknown): string {
    const builder = new XMLBuilder({ ignoreAttributes: true });
    return `${builder.build({ data: value })}\n`;
  }

  private static fromToml(text: string): unknown {
    const parsed = parseToml(text);
    if (text.includes("[[row]]") && parsed && typeof parsed === "object" && "row" in parsed && Array.isArray(parsed.row)) {
      return parsed.row;
    }
    return parsed;
  }

  private static toToml(value: unknown): string {
    if (Array.isArray(value)) {
      if (!value.every((row) => row !== null && typeof row === "object" && !Array.isArray(row))) {
        throw new ConversionError("not-tabular", "TOML arrays must be arrays of objects");
      }
      const blocks = value.map((row) => `[[row]]\n${stringifyToml(row as Record<string, unknown>).trim()}`);
      return `${blocks.join("\n\n")}\n`;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConversionError("engine-failed", "TOML needs an object or an array of objects");
    }
    return stringifyToml(value as Record<string, unknown>);
  }
}
