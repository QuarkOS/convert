import type { Engine } from "./domain.ts";
import { DataEngine } from "./engines/data-engine.ts";
import { FfmpegEngine } from "./engines/ffmpeg-engine.ts";
import { HeicEngine } from "./engines/heic-engine.ts";
import { OfficeEngine } from "./engines/office-engine.ts";
import { PandocEngine } from "./engines/pandoc-engine.ts";
import { PdfEngine } from "./engines/pdf-engine.ts";
import { RasterEngine } from "./engines/raster-engine.ts";
import { SharpEngine } from "./engines/sharp-engine.ts";
import { SpreadsheetEngine } from "./engines/spreadsheet-engine.ts";

export class NodeEngines {
  static host(): readonly Engine[] {
    return [
      HeicEngine,
      SharpEngine,
      RasterEngine,
      PandocEngine,
      OfficeEngine,
      PdfEngine,
      SpreadsheetEngine,
      DataEngine,
      FfmpegEngine,
    ];
  }

  static bundled(): readonly Engine[] {
    return NodeEngines.host().filter((engine) => engine.id !== "pandoc");
  }
}
