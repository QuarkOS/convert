import { BmpCodec, type RgbaImage } from "./bmp-codec.ts";
import { ConversionError } from "./domain.ts";

export class IcoCodec {
  static fromPng(png: Uint8Array, width: number, height: number): Uint8Array {
    const header = 22;
    const out = new Uint8Array(header + png.length);
    const view = new DataView(out.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    out[6] = width >= 256 ? 0 : width;
    out[7] = height >= 256 ? 0 : height;
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
    view.setUint32(14, png.length, true);
    view.setUint32(18, header, true);
    out.set(png, header);
    return out;
  }

  static embeddedPng(bytes: Uint8Array): Uint8Array | null {
    const image = IcoCodec.firstImage(bytes);
    if (image.length >= 8 && image[0] === 0x89 && image[1] === 0x50 && image[2] === 0x4e && image[3] === 0x47) {
      return image;
    }
    return null;
  }

  static toRgba(bytes: Uint8Array): RgbaImage {
    const png = IcoCodec.embeddedPng(bytes);
    if (png) {
      throw new ConversionError("engine-failed", "PNG-in-ICO is decoded by the image engine");
    }
    const image = IcoCodec.firstImage(bytes);
    if (image.length < 40) {
      throw new ConversionError("engine-failed", "ICO image is truncated");
    }
    const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
    const headerSize = view.getUint32(0, true);
    const width = view.getInt32(4, true);
    const rawHeight = view.getInt32(8, true);
    const bits = view.getUint16(14, true);
    if (width <= 0 || rawHeight === 0 || headerSize < 40) {
      throw new ConversionError("engine-failed", "ICO bitmap header is invalid");
    }
    const entryHeight = bytes[7] === 0 ? 256 : (bytes[7] ?? width);
    const height = Math.abs(rawHeight) === entryHeight * 2 ? entryHeight : Math.abs(rawHeight);
    const file = BmpCodec.encode({ width: 1, height: 1, rgba: new Uint8Array(4) });
    const dib = image;
    const bmp = new Uint8Array(14 + dib.length);
    bmp.set(file.subarray(0, 14), 0);
    bmp.set(dib, 14);
    const bmpView = new DataView(bmp.buffer);
    bmpView.setUint32(2, bmp.length, true);
    bmpView.setUint32(10, 14 + headerSize, true);
    bmpView.setInt32(22, height, true);
    return BmpCodec.decode(bmp);
  }

  private static firstImage(bytes: Uint8Array): Uint8Array {
    if (bytes.length < 22 || bytes[0] !== 0 || bytes[1] !== 0 || bytes[2] !== 1 || bytes[3] !== 0) {
      throw new ConversionError("engine-failed", "Not an ICO file");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint16(4, true);
    if (count < 1) throw new ConversionError("engine-failed", "ICO has no images");
    const size = view.getUint32(14, true);
    const offset = view.getUint32(18, true);
    if (offset + size > bytes.length) throw new ConversionError("engine-failed", "ICO image is truncated");
    return bytes.subarray(offset, offset + size);
  }
}
