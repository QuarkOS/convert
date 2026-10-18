import { ConversionError, type ConversionResult, type Engine, type FormatId } from "./domain.ts";
import { FormatGraph } from "./format-graph.ts";

export class ConversionJob {
  static async run(input: {
    bytes: Uint8Array;
    from: FormatId;
    to: FormatId;
    engines: readonly Engine[];
  }): Promise<ConversionResult> {
    const edges = FormatGraph.compile(input.engines);
    const chain = FormatGraph.path(edges, input.from, input.to);
    if (!chain) {
      return {
        ok: false,
        code: "no-path",
        message: `No conversion from ${input.from} to ${input.to}`,
      };
    }
    let bytes = input.bytes;
    const byId = new Map(input.engines.map((engine) => [engine.id, engine]));
    for (const edge of chain) {
      const engine = byId.get(edge.engineId);
      if (!engine) {
        return { ok: false, code: "engine-failed", message: `Missing engine ${edge.engineId}` };
      }
      try {
        const owned = new Uint8Array(bytes.byteLength);
        owned.set(bytes);
        bytes = new Uint8Array(await engine.convert(owned, edge.from, edge.to));
      } catch (error) {
        if (error instanceof ConversionError) {
          return { ok: false, code: error.code, message: error.message };
        }
        const message = error instanceof Error ? error.message : "Conversion failed";
        return { ok: false, code: "engine-failed", message };
      }
    }
    return {
      ok: true,
      bytes,
      from: input.from,
      to: input.to,
      steps: [input.from, ...chain.map((edge) => edge.to)],
    };
  }
}
