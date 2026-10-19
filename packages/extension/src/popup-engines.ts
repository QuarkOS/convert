import type { Engine } from "../../core/src/domain.ts";
import { DataEngine } from "../../core/src/engines/data-engine.ts";
import { OfficeEngine } from "../../core/src/engines/office-engine.ts";
import { PdfEngine } from "../../core/src/engines/pdf-engine.ts";
import { CanvasRasterEngine } from "./canvas-raster.ts";
import { TabularEngine } from "./tabular-engine.ts";

export class PopupEngines {
  static list(): readonly Engine[] {
    return [CanvasRasterEngine, TabularEngine, OfficeEngine, PdfEngine, DataEngine];
  }
}
