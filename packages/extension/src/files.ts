import type { FormatId } from "../../core/src/domain.ts";
import { FormatCatalog } from "../../core/src/format-catalog.ts";

export class FileReplacer {
  static apply(input: HTMLInputElement, file: File): void {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export class FileDownload {
  static save(filename: string, bytes: Uint8Array, mediaType: string): void {
    const blob = new Blob([new Uint8Array(bytes)], { type: mediaType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

export class ConvertedFile {
  static build(originalName: string, to: FormatId, bytes: Uint8Array): File {
    return new File([new Uint8Array(bytes)], FormatCatalog.rename(originalName, to), {
      type: FormatCatalog.mediaType(to),
    });
  }
}
