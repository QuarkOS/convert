import { ConversionError } from "./domain.ts";

export type RgbaImage = {
  width: number;
  height: number;
  rgba: Uint8Array;
};

export class BmpCodec {
  static encode(image: RgbaImage): Uint8Array {
    const { width, height, rgba } = image;
    if (rgba.length < width * height * 4) {
      throw new ConversionError("engine-failed", "BMP source is shorter than its dimensions");
    }
    const stride = Math.ceil((width * 3) / 4) * 4;
    const pixels = stride * height;
    const offset = 54;
    const bytes = new Uint8Array(offset + pixels);
    const view = new DataView(bytes.buffer);
    bytes[0] = 0x42;
    bytes[1] = 0x4d;
    view.setUint32(2, bytes.length, true);
    view.setUint32(10, offset, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, width, true);
    view.setInt32(22, height, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(34, pixels, true);
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y;
      const row = offset + y * stride;
      for (let x = 0; x < width; x++) {
        const i = (srcY * width + x) * 4;
        const o = row + x * 3;
        bytes[o] = rgba[i + 2] ?? 0;
        bytes[o + 1] = rgba[i + 1] ?? 0;
        bytes[o + 2] = rgba[i] ?? 0;
      }
    }
    return bytes;
  }

  static decode(bytes: Uint8Array): RgbaImage {
    if (bytes.length < 54 || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
      throw new ConversionError("engine-failed", "Not a BMP file");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const pixelOffset = view.getUint32(10, true);
    const width = view.getInt32(18, true);
    const rawHeight = view.getInt32(22, true);
    const bits = view.getUint16(28, true);
    const compression = view.getUint32(30, true);
    if (width <= 0 || rawHeight === 0) {
      throw new ConversionError("engine-failed", "BMP has no pixels");
    }
    if (compression !== 0 || (bits !== 24 && bits !== 32)) {
      throw new ConversionError("engine-failed", `Unsupported BMP (${bits}-bit, compression ${compression})`);
    }
    const height = Math.abs(rawHeight);
    const topDown = rawHeight < 0;
    const channels = bits / 8;
    const stride = Math.floor((width * bits + 31) / 32) * 4;
    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      const row = pixelOffset + srcY * stride;
      for (let x = 0; x < width; x++) {
        const i = row + x * channels;
        const o = (y * width + x) * 4;
        rgba[o] = bytes[i + 2] ?? 0;
        rgba[o + 1] = bytes[i + 1] ?? 0;
        rgba[o + 2] = bytes[i] ?? 0;
        rgba[o + 3] = bits === 32 ? (bytes[i + 3] ?? 255) : 255;
      }
    }
    return { width, height, rgba };
  }
}
