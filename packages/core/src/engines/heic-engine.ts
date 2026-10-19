import decode from "heic-decode";
import sharp from "sharp";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";

export class HeicEngine {
  static readonly id = "heic";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return [{ from: "heic", to: "png" }];
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    if (from !== "heic" || to !== "png") {
      throw new ConversionError("engine-failed", "HEIC only decodes to PNG");
    }
    const decoded = await decode({ buffer: Buffer.from(input) });
    return sharp(Buffer.from(decoded.data), {
      raw: { width: decoded.width, height: decoded.height, channels: 4 },
    })
      .png()
      .toBuffer();
  }
}
