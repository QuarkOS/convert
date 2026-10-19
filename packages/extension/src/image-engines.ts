import type { Engine } from "../../core/src/domain.ts";
import { CanvasRasterEngine } from "./canvas-raster.ts";

export class ImageEngines {
  static list(): readonly Engine[] {
    return [CanvasRasterEngine];
  }
}
