import { NativeMenu } from "./native-menu.ts";
import { ExtensionSettings } from "./settings.ts";

NativeMenu.install();

chrome.runtime.onInstalled.addListener(() => {
  void ExtensionSettings.read().then((prefs) => {
    void chrome.storage.local.set(prefs);
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "fetch-url" || typeof message.url !== "string") return undefined;
  void BackgroundFetch.read(message.url).then(sendResponse);
  return true;
});

class BackgroundFetch {
  static async read(url: string): Promise<{ ok: true; bytes: number[]; mediaType: string } | { ok: false; error: string }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: "That address is not a file Convert can read" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "Convert only reads http and https files from a page" };
    }
    try {
      const response = await fetch(parsed);
      if (!response.ok) return { ok: false, error: `Could not read that file (HTTP ${response.status})` };
      const bytes = Array.from(new Uint8Array(await response.arrayBuffer()));
      const mediaType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
      return { ok: true, bytes, mediaType };
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not read that file";
      return { ok: false, error: text };
    }
  }
}
