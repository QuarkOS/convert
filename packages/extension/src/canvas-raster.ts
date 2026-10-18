import { BmpCodec } from "../../core/src/bmp-codec.ts";
import { ConversionError, type FormatId } from "../../core/src/domain.ts";
import { FormatCatalog } from "../../core/src/format-catalog.ts";
import { IcoCodec } from "../../core/src/ico-codec.ts";

type Raster = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

type Drawable = OffscreenCanvas | HTMLCanvasElement;

export class CanvasRasterEngine {
  static readonly id = "canvas-raster";

  static readonly sources = ["png", "jpg", "webp", "avif", "gif", "bmp", "ico", "svg"] as const satisfies readonly FormatId[];

  static readonly targets = ["png", "jpg", "webp", "bmp", "ico"] as const satisfies readonly FormatId[];

  static available(): boolean {
    return typeof OffscreenCanvas === "function" || typeof document !== "undefined";
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    const edges: { from: FormatId; to: FormatId }[] = [];
    for (const from of CanvasRasterEngine.sources) {
      for (const to of CanvasRasterEngine.targets) {
        if (from !== to) edges.push({ from, to });
      }
    }
    return edges;
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const image = await CanvasRasterEngine.decode(input, from);
    return CanvasRasterEngine.encode(image, to);
  }

  private static async decode(bytes: Uint8Array, from: FormatId): Promise<Raster> {
    if (from === "bmp") return BmpCodec.decode(bytes);
    if (from === "ico") {
      const png = IcoCodec.embeddedPng(bytes);
      if (png) return CanvasRasterEngine.decodeBitmap(png, "image/png");
      return IcoCodec.toRgba(bytes);
    }
    return CanvasRasterEngine.decodeBitmap(bytes, FormatCatalog.mediaType(from));
  }

  private static async encode(image: Raster, to: FormatId): Promise<Uint8Array> {
    if (to === "bmp") return BmpCodec.encode(image);
    const type = to === "jpg" ? "image/jpeg" : to === "webp" ? "image/webp" : "image/png";
    const quality = to === "png" ? undefined : 0.92;
    const blob = await CanvasRasterEngine.blob(image, type, quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (to === "ico") return IcoCodec.fromPng(bytes, image.width, image.height);
    return bytes;
  }

  private static async decodeBitmap(bytes: Uint8Array, mediaType: string): Promise<Raster> {
    const blob = new Blob([new Uint8Array(bytes)], { type: mediaType });
    const bitmap = await createImageBitmap(blob);
    try {
      if (bitmap.width < 1 || bitmap.height < 1) {
        throw new ConversionError("engine-failed", "Image has no pixels");
      }
      const canvas = CanvasRasterEngine.canvas(bitmap.width, bitmap.height);
      const ctx = CanvasRasterEngine.context2d(canvas);
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      return { width: bitmap.width, height: bitmap.height, rgba: new Uint8Array(data.data) };
    } finally {
      bitmap.close();
    }
  }

  private static async blob(image: Raster, type: string, quality?: number): Promise<Blob> {
    const canvas = CanvasRasterEngine.canvas(image.width, image.height);
    const ctx = CanvasRasterEngine.context2d(canvas);
    const clamped = new Uint8ClampedArray(image.rgba);
    ctx.putImageData(new ImageData(clamped, image.width, image.height), 0, 0);
    if (canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type, quality });
    }
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), type, quality);
    });
    if (!blob) throw new ConversionError("engine-failed", `Could not write ${type}`);
    return blob;
  }

  private static context2d(canvas: Drawable): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
    const ctx = canvas.getContext("2d");
    if (!ctx || !("getImageData" in ctx) || !("drawImage" in ctx)) {
      throw new ConversionError("engine-failed", "Canvas is unavailable");
    }
    return ctx;
  }

  private static canvas(width: number, height: number): Drawable {
    if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
}
