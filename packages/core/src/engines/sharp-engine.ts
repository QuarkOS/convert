import sharp from "sharp";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";
import { Pairs } from "../pairs.ts";

const STILLS = ["png", "jpg", "webp", "avif", "gif"] as const satisfies readonly FormatId[];

export class SharpEngine {
  static readonly id = "sharp";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    const edges: { from: FormatId; to: FormatId }[] = Pairs.directed(STILLS);
    for (const to of STILLS) edges.push({ from: "svg", to });
    return edges;
  }

  static async convert(input: Uint8Array, _from: FormatId, to: FormatId): Promise<Uint8Array> {
    const pipeline = sharp(Buffer.from(input), { failOn: "none" });
    if (to === "jpg") return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
    if (to === "png") return pipeline.png().toBuffer();
    if (to === "webp") return pipeline.webp({ quality: 80 }).toBuffer();
    if (to === "avif") return pipeline.avif({ quality: 50 }).toBuffer();
    if (to === "gif") return pipeline.gif().toBuffer();
    throw new ConversionError("engine-failed", `sharp cannot write ${to}`);
  }
}
