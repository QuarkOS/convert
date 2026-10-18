declare module "heic-decode" {
  export default function decode(input: {
    buffer: Uint8Array;
  }): Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export function getDocument(params: {
    data: Uint8Array;
    disableWorker?: boolean;
    verbosity?: number;
    disableFontFace?: boolean;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{
        getTextContent(): Promise<{ items: readonly { str?: string }[] }>;
      }>;
    }>;
  };
}
