import { FormatCatalog } from "../../core/src/format-catalog.ts";
import type { FormatId } from "../../core/src/domain.ts";
import { CanvasRasterEngine } from "./canvas-raster.ts";

export type NativeMenuItem = {
  id: string;
  title: string;
  patterns: string[];
};

export class NativeMenu {
  static readonly parentId = "convert-to";
  static readonly mark = "➜";

  static title(): string {
    return `${NativeMenu.mark} Convert to`;
  }

  static install(): void {
    chrome.runtime.onInstalled.addListener(() => {
      void NativeMenu.rebuild();
    });
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      void NativeMenu.clicked(info, tab);
    });
    void NativeMenu.rebuild();
  }

  static items(): NativeMenuItem[] {
    const rows: NativeMenuItem[] = [];
    for (const edge of CanvasRasterEngine.edges()) {
      rows.push({
        id: NativeMenu.itemId(edge.from, edge.to),
        title: `.${FormatCatalog.extension(edge.to)}`,
        patterns: NativeMenu.patterns(edge.from),
      });
    }
    return rows;
  }

  static patterns(extension: string): string[] {
    return [
      `*://*/*.${extension}`,
      `*://*/*.${extension}?*`,
      `*://*/*/*.${extension}`,
      `*://*/*/*.${extension}?*`,
      `*://*/*/*/*.${extension}`,
      `*://*/*/*/*.${extension}?*`,
    ];
  }

  static itemId(from: FormatId, to: FormatId): string {
    return `convert:${from}:${to}`;
  }

  static parseItemId(id: string): { from: FormatId; to: FormatId } | null {
    const parts = id.split(":");
    if (parts.length !== 3 || parts[0] !== "convert") return null;
    const from = FormatCatalog.parse(parts[1] ?? "");
    const to = FormatCatalog.parse(parts[2] ?? "");
    if (!from || !to) return null;
    return { from, to };
  }

  static async rebuild(): Promise<void> {
    await chrome.contextMenus.removeAll();
    const items = NativeMenu.items();
    const patterns = [...new Set(items.flatMap((item) => item.patterns))];
    chrome.contextMenus.create({
      id: NativeMenu.parentId,
      title: NativeMenu.title(),
      contexts: ["image", "link"],
      targetUrlPatterns: patterns,
    });
    for (const item of items) {
      chrome.contextMenus.create({
        id: item.id,
        parentId: NativeMenu.parentId,
        title: item.title,
        contexts: ["image", "link"],
        targetUrlPatterns: item.patterns,
      });
    }
  }

  static async clicked(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): Promise<void> {
    const parsed = NativeMenu.parseItemId(String(info.menuItemId));
    const url = info.srcUrl || info.linkUrl || "";
    if (!parsed || !url || tab?.id === undefined) return;
    await chrome.tabs.sendMessage(tab.id, { type: "native-convert", url, to: parsed.to });
  }
}
