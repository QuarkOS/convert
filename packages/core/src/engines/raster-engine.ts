import sharp from "sharp";
import { BmpCodec } from "../bmp-codec.ts";
import type { FormatId } from "../domain.ts";
import { ConversionError } from "../domain.ts";
import { IcoCodec } from "../ico-codec.ts";

const PIXELS = ["png", "jpg", "webp", "avif", "gif", "bmp", "ico"] as const satisfies readonly FormatId[];

export class RasterEngine {
  static readonly id = "raster";

  static available(): boolean {
    return true;
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    const edges: { from: FormatId; to: FormatId }[] = [];
    for (const from of PIXELS) {
      for (const to of PIXELS) {
        if (from === to) continue;
        if (from === "bmp" || from === "ico" || to === "bmp" || to === "ico") {
          edges.push({ from, to });
        }
      }
    }
    return edges;
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const image = await RasterEngine.pixels(input, from);
    if (to === "bmp") return BmpCodec.encode(image);
    if (to === "ico") {
      const fitted = await RasterEngine.fitIcon(image);
      const png = await sharp(fitted.rgba, {
        raw: { width: fitted.width, height: fitted.height, channels: 4 },
      })
        .png()
        .toBuffer();
      return IcoCodec.fromPng(png, fitted.width, fitted.height);
    }
    return SharpWrite.write(image, to);
  }

  private static async pixels(input: Uint8Array, from: FormatId): Promise<{
    width: number;
    height: number;
    rgba: Uint8Array;
  }> {
    if (from === "bmp") return BmpCodec.decode(input);
    if (from === "ico") {
      const png = IcoCodec.embeddedPng(input);
      if (png) return RasterEngine.pixels(png, "png");
      return IcoCodec.toRgba(input);
    }
    const { data, info } = await sharp(Buffer.from(input)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, rgba: data };
  }

  private static async fitIcon(image: { width: number; height: number; rgba: Uint8Array }) {
    if (image.width <= 256 && image.height <= 256) return image;
    const { data, info } = await sharp(image.rgba, {
      raw: { width: image.width, height: image.height, channels: 4 },
    })
      .resize(256, 256, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { width: info.width, height: info.height, rgba: data };
  }
}

class SharpWrite {
  static async write(image: { width: number; height: number; rgba: Uint8Array }, to: FormatId): Promise<Uint8Array> {
    const pipeline = sharp(image.rgba, {
      raw: { width: image.width, height: image.height, channels: 4 },
    });
    if (to === "jpg") return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer();
    if (to === "png") return pipeline.png().toBuffer();
    if (to === "webp") return pipeline.webp({ quality: 80 }).toBuffer();
    if (to === "avif") return pipeline.avif({ quality: 50 }).toBuffer();
    if (to === "gif") return pipeline.gif().toBuffer();
    throw new ConversionError("engine-failed", `raster cannot write ${to}`);
  }
}
