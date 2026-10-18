export const FORMAT_RECORDS = [
  { id: "png", extension: "png", mediaType: "image/png", family: "image", aliases: [] },
  { id: "jpg", extension: "jpg", mediaType: "image/jpeg", family: "image", aliases: ["jpeg"] },
  { id: "webp", extension: "webp", mediaType: "image/webp", family: "image", aliases: [] },
  { id: "avif", extension: "avif", mediaType: "image/avif", family: "image", aliases: [] },
  { id: "gif", extension: "gif", mediaType: "image/gif", family: "image", aliases: [] },
  { id: "bmp", extension: "bmp", mediaType: "image/bmp", family: "image", aliases: [] },
  { id: "ico", extension: "ico", mediaType: "image/x-icon", family: "image", aliases: [] },
  { id: "svg", extension: "svg", mediaType: "image/svg+xml", family: "image", aliases: [] },
  { id: "heic", extension: "heic", mediaType: "image/heic", family: "image", aliases: ["heif"] },
  {
    id: "docx",
    extension: "docx",
    mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    family: "document",
    aliases: [],
  },
  { id: "pdf", extension: "pdf", mediaType: "application/pdf", family: "document", aliases: [] },
  { id: "md", extension: "md", mediaType: "text/markdown", family: "document", aliases: ["markdown"] },
  { id: "html", extension: "html", mediaType: "text/html", family: "document", aliases: ["htm"] },
  { id: "txt", extension: "txt", mediaType: "text/plain", family: "document", aliases: ["text"] },
  {
    id: "odt",
    extension: "odt",
    mediaType: "application/vnd.oasis.opendocument.text",
    family: "document",
    aliases: [],
  },
  { id: "rtf", extension: "rtf", mediaType: "application/rtf", family: "document", aliases: [] },
  {
    id: "xlsx",
    extension: "xlsx",
    mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    family: "spreadsheet",
    aliases: [],
  },
  { id: "csv", extension: "csv", mediaType: "text/csv", family: "spreadsheet", aliases: [] },
  {
    id: "ods",
    extension: "ods",
    mediaType: "application/vnd.oasis.opendocument.spreadsheet",
    family: "spreadsheet",
    aliases: [],
  },
  { id: "mp3", extension: "mp3", mediaType: "audio/mpeg", family: "audio", aliases: [] },
  { id: "wav", extension: "wav", mediaType: "audio/wav", family: "audio", aliases: [] },
  { id: "flac", extension: "flac", mediaType: "audio/flac", family: "audio", aliases: [] },
  { id: "ogg", extension: "ogg", mediaType: "audio/ogg", family: "audio", aliases: [] },
  { id: "m4a", extension: "m4a", mediaType: "audio/mp4", family: "audio", aliases: [] },
  { id: "mp4", extension: "mp4", mediaType: "video/mp4", family: "video", aliases: [] },
  { id: "webm", extension: "webm", mediaType: "video/webm", family: "video", aliases: [] },
  { id: "mov", extension: "mov", mediaType: "video/quicktime", family: "video", aliases: [] },
  { id: "json", extension: "json", mediaType: "application/json", family: "data", aliases: [] },
  { id: "yaml", extension: "yaml", mediaType: "application/yaml", family: "data", aliases: ["yml"] },
  { id: "xml", extension: "xml", mediaType: "application/xml", family: "data", aliases: [] },
  { id: "toml", extension: "toml", mediaType: "application/toml", family: "data", aliases: [] },
] as const;

export type FormatRecord = (typeof FORMAT_RECORDS)[number];
export type FormatId = FormatRecord["id"];
export type FormatFamily = FormatRecord["family"];

export type Edge = {
  readonly from: FormatId;
  readonly to: FormatId;
  readonly engineId: string;
};

export type Engine = {
  readonly id: string;
  available(): boolean;
  edges(): readonly { from: FormatId; to: FormatId }[];
  convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array>;
};

export type ConversionCode = "no-path" | "not-tabular" | "engine-failed";

export class ConversionError extends Error {
  readonly code: ConversionCode;

  constructor(code: ConversionCode, message: string) {
    super(message);
    this.name = "ConversionError";
    this.code = code;
  }
}

export type ConversionOk = {
  ok: true;
  bytes: Uint8Array;
  from: FormatId;
  to: FormatId;
  steps: readonly FormatId[];
};

export type ConversionErr = {
  ok: false;
  code: ConversionCode;
  message: string;
};

export type ConversionResult = ConversionOk | ConversionErr;
