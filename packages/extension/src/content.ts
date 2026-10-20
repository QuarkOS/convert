import { ConversionJob } from "../../core/src/conversion-job.ts";
import type { FormatId } from "../../core/src/domain.ts";
import { FormatCatalog } from "../../core/src/format-catalog.ts";
import { FormatGraph } from "../../core/src/format-graph.ts";
import { ConvertedFile, FileDownload, FileReplacer } from "./files.ts";
import { ImageEngines } from "./image-engines.ts";
import type { RescueDecision } from "./rescue.ts";
import { RescuePolicy } from "./rescue.ts";
import { ExtensionSettings, type ExtensionPrefs } from "./settings.ts";
import { ToastChrome } from "./toast-chrome.ts";

const PANEL_CSS = `
  :host { all: initial; }
  .panel {
    position: fixed;
    z-index: 2147483647;
    width: min(240px, calc(100vw - 16px));
    padding: 10px;
    border: 1px solid #d9d1c3;
    border-radius: 10px;
    background: #fffdf8;
    color: #1a1916;
    box-shadow: 0 10px 30px rgba(40, 32, 20, 0.16);
    font: 13px/1.4 "Segoe UI", system-ui, sans-serif;
  }
  h2 { margin: 0 0 4px; font-size: 13px; letter-spacing: 0.02em; }
  p { margin: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  button {
    font: inherit;
    cursor: pointer;
  }
  button.filled {
    border: 1px solid #143d32;
    border-radius: 999px;
    background: #143d32;
    color: #f6f3ec;
    padding: 6px 11px;
  }
  button.outline {
    border: 1px solid #e4ddd2;
    border-radius: 999px;
    background: transparent;
    color: #8a8175;
    padding: 6px 11px;
  }
  button.secondary {
    display: block;
    margin-top: 8px;
    border: 1px solid #c9c0b0;
    border-radius: 999px;
    background: #fffdf8;
    color: #1a1916;
    padding: 6px 11px;
  }
  button.link {
    display: block;
    margin-top: 6px;
    border: 0;
    background: transparent;
    color: #8a8175;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .error { color: #8d2d2d; margin-top: 8px; }
`;

class PageRescue {
  static #prefs: ExtensionPrefs = { globalEnabled: true, disabledOrigins: [] };
  static #host: HTMLElement | null = null;
  static #applying = false;
  static #edges = FormatGraph.compile(ImageEngines.list());

  static install(): void {
    chrome.storage.onChanged.addListener(() => {
      void ExtensionSettings.read().then((prefs) => {
        PageRescue.#prefs = prefs;
      });
    });
    void ExtensionSettings.read().then((prefs) => {
      PageRescue.#prefs = prefs;
      PageRescue.listen();
    });
  }

  private static listen(): void {
    document.addEventListener("change", (event) => PageRescue.onChange(event), true);
    document.addEventListener("drop", (event) => PageRescue.onDrop(event), true);
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.type !== "native-convert" || typeof message.url !== "string") return;
      const to = FormatCatalog.parse(String(message.to ?? ""));
      const named = PageRescue.formatOfUrl(message.url);
      if (!to || !named || named.from === to) return;
      const panel = PageRescue.openPanel(24, 24);
      const title = document.createElement("h2");
      title.textContent = "Converting…";
      panel.append(title);
      void PageRescue.convertUrl(message.url, named.filename, named.from, to, panel);
    });
    document.addEventListener("click", (event) => PageRescue.onPageClick(event), true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") PageRescue.close();
    });
    document.documentElement.dataset.convertReady = "1";
  }

  private static onChange(event: Event): void {
    if (PageRescue.#applying) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    const file = input.files?.[0];
    if (!file) return;
    const decision = PageRescue.acceptDecision(input, file);
    if (decision.show) {
      event.preventDefault();
      event.stopImmediatePropagation();
      PageRescue.showToast(input, file, decision);
      return;
    }
    PageRescue.watchRejection(input, file);
  }

  private static onDrop(event: DragEvent): void {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    const input = PageRescue.fileInput(event.target);
    if (!input) return;
    const decision = PageRescue.acceptDecision(input, file, true);
    if (!decision.show) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    PageRescue.showToast(input, file, decision);
  }

  private static onPageClick(event: Event): void {
    const host = PageRescue.#host;
    if (!host) return;
    if (event.composedPath().includes(host)) return;
    PageRescue.close();
  }

  private static acceptDecision(input: HTMLInputElement, file: File, dropped = false): RescueDecision {
    const from = FormatCatalog.fromFilename(file.name);
    const targets = from ? FormatGraph.targets(PageRescue.#edges, from) : [];
    return RescuePolicy.fromAccept({
      filename: file.name,
      accept: dropped ? input.accept || input.dataset.accept || "" : input.accept,
      hintText: PageRescue.hintText(input),
      enabled: ExtensionSettings.allows(PageRescue.#prefs, location.origin),
      targets,
    });
  }

  private static watchRejection(input: HTMLInputElement, file: File): void {
    const started = Date.now();
    const scan = (): boolean => {
      const alertText = PageRescue.alertText(input);
      if (!alertText) return false;
      const from = FormatCatalog.fromFilename(file.name);
      const targets = from ? FormatGraph.targets(PageRescue.#edges, from) : [];
      const decision = RescuePolicy.fromRejection({
        filename: file.name,
        accept: input.accept,
        hintText: PageRescue.hintText(input),
        alertText,
        enabled: ExtensionSettings.allows(PageRescue.#prefs, location.origin),
        targets,
      });
      if (decision.show) PageRescue.showToast(input, file, decision);
      return decision.show;
    };
    if (scan()) return;
    const observer = new MutationObserver(() => {
      if (scan() || Date.now() - started > 1500) observer.disconnect();
    });
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    window.setTimeout(() => observer.disconnect(), 1600);
  }

  private static showToast(input: HTMLInputElement, file: File, decision: RescueDecision): void {
    const alert = input.form?.querySelector("[role='alert']");
    const anchor = alert instanceof HTMLElement && (alert.textContent?.trim() ?? "").length > 0 ? alert : input;
    const box = anchor.getBoundingClientRect();
    const panel = PageRescue.openPanel(box.left, box.bottom + 8);
    const message = document.createElement("p");
    message.dataset.convertToast = "offer";
    message.textContent = decision.message;
    const actions = document.createElement("div");
    actions.className = "actions";
    for (const to of decision.targets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = ToastChrome.formatClass(to, decision.targets);
      button.dataset.target = to;
      button.textContent = `.${FormatCatalog.extension(to)}`;
      button.addEventListener("click", () => {
        void PageRescue.convertInto(input, file, to, panel);
      });
      actions.append(button);
    }
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = ToastChrome.originalClass();
    dismiss.textContent = "Use original";
    dismiss.addEventListener("click", () => PageRescue.release(input, file));
    const mute = document.createElement("button");
    mute.type = "button";
    mute.className = ToastChrome.muteClass();
    mute.dataset.convertMute = "site";
    mute.textContent = ToastChrome.muteLabel();
    mute.addEventListener("click", () => {
      void ExtensionSettings.setOrigin(location.origin, false).then(() => {
        PageRescue.#prefs = {
          ...PageRescue.#prefs,
          disabledOrigins: [...new Set([...PageRescue.#prefs.disabledOrigins, location.origin])],
        };
        PageRescue.release(input, file);
      });
    });
    panel.append(message, actions, dismiss, mute);
  }

  private static showMenu(
    x: number,
    y: number,
    url: string,
    filename: string,
    from: FormatId,
    targets: readonly FormatId[],
  ): void {
    const panel = PageRescue.openPanel(x, y);
    panel.dataset.convertMenu = "open";
    const title = document.createElement("h2");
    title.textContent = "Convert to";
    const actions = document.createElement("div");
    actions.className = "actions";
    for (const to of targets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = ToastChrome.formatClass(to, targets);
      button.dataset.target = to;
      button.textContent = `.${FormatCatalog.extension(to)}`;
      button.addEventListener("click", () => {
        void PageRescue.convertUrl(url, filename, from, to, panel);
      });
      actions.append(button);
    }
    panel.append(title, actions);
  }

  private static async convertInto(input: HTMLInputElement, file: File, to: FormatId, panel: HTMLElement): Promise<void> {
    const from = FormatCatalog.fromFilename(file.name);
    if (!from) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ConversionJob.run({ bytes, from, to, engines: ImageEngines.list() });
    if (!result.ok) {
      PageRescue.note(panel, result.message);
      return;
    }
    const next = ConvertedFile.build(file.name, to, result.bytes);
    PageRescue.#applying = true;
    PageRescue.close();
    FileReplacer.apply(input, next);
    PageRescue.#applying = false;
  }

  private static async convertUrl(
    url: string,
    filename: string,
    from: FormatId,
    to: FormatId,
    panel: HTMLElement,
  ): Promise<void> {
    const loaded = await PageRescue.readUrl(url, filename);
    if (!loaded.ok) {
      PageRescue.note(panel, loaded.error);
      return;
    }
    const result = await ConversionJob.run({
      bytes: loaded.bytes,
      from,
      to,
      engines: ImageEngines.list(),
    });
    if (!result.ok) {
      PageRescue.note(panel, result.message);
      return;
    }
    FileDownload.save(FormatCatalog.rename(loaded.filename, to), result.bytes, FormatCatalog.mediaType(to));
    PageRescue.close();
  }

  private static async readUrl(
    url: string,
    filename: string,
  ): Promise<{ ok: true; bytes: Uint8Array; filename: string } | { ok: false; error: string }> {
    if (url.startsWith("data:")) {
      const parsed = PageRescue.dataUrl(url);
      if (!parsed) return { ok: false, error: "Could not read that image" };
      return { ok: true, bytes: parsed, filename };
    }
    const response = await chrome.runtime.sendMessage({ type: "fetch-url", url });
    const bytes = PageRescue.asBytes(response && typeof response === "object" ? response.bytes : null);
    if (!response || response.ok !== true || !bytes) {
      const error = response && typeof response.error === "string" ? response.error : "Could not read that file";
      return { ok: false, error };
    }
    return { ok: true, bytes, filename };
  }

  private static release(input: HTMLInputElement, file: File): void {
    PageRescue.close();
    if (input.files?.[0] === file) {
      PageRescue.#applying = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      PageRescue.#applying = false;
    }
  }

  private static openPanel(x: number, y: number): HTMLElement {
    PageRescue.close();
    const host = document.createElement("div");
    host.id = "convert-rescue-host";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = PANEL_CSS;
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 256))}px`;
    panel.style.top = `${Math.max(8, Math.min(y, window.innerHeight - 160))}px`;
    shadow.append(style, panel);
    document.documentElement.append(host);
    PageRescue.#host = host;
    return panel;
  }

  private static note(panel: HTMLElement, text: string): void {
    let note = panel.querySelector(".error");
    if (!(note instanceof HTMLElement)) {
      note = document.createElement("p");
      note.className = "error";
      panel.append(note);
    }
    note.textContent = text;
  }

  private static close(): void {
    PageRescue.#host?.remove();
    PageRescue.#host = null;
  }

  private static fileInput(target: EventTarget | null): HTMLInputElement | null {
    if (target instanceof HTMLInputElement && target.type === "file") return target;
    if (!(target instanceof Element)) return null;
    if (target instanceof HTMLLabelElement && target.control instanceof HTMLInputElement && target.control.type === "file") {
      return target.control;
    }
    const zone = target.closest("form, label, [data-dropzone]") ?? target.parentElement;
    const input = zone?.querySelector("input[type='file']");
    return input instanceof HTMLInputElement ? input : null;
  }

  private static hintText(input: HTMLInputElement): string {
    const bits: string[] = [];
    if (input.labels) {
      for (const label of input.labels) bits.push(label.innerText);
    }
    const described = input.getAttribute("aria-describedby");
    if (described) {
      for (const id of described.split(/\s+/)) {
        bits.push(document.getElementById(id)?.textContent ?? "");
      }
    }
    const zone = input.closest("[data-dropzone]");
    if (zone) bits.push(zone.textContent ?? "");
    return bits.join("\n");
  }

  private static alertText(input: HTMLInputElement): string {
    const root = input.form ?? input.parentElement ?? document.body;
    const bits: string[] = [];
    for (const node of root.querySelectorAll("[role='alert'], [aria-live='assertive'], [aria-live='polite']")) {
      const text = node.textContent?.trim() ?? "";
      if (text) bits.push(text);
    }
    return bits.join("\n");
  }

  private static formatOfUrl(url: string): { from: FormatId; filename: string } | null {
    if (url.startsWith("data:")) {
      const media = url.slice(5).split(/[;,]/)[0] ?? "";
      const from = FormatCatalog.parse(media);
      if (!from) return null;
      return { from, filename: `image.${FormatCatalog.extension(from)}` };
    }
    let filename = url;
    try {
      filename = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? url);
    } catch {
      filename = url.split("/").pop() ?? url;
    }
    const from = FormatCatalog.fromFilename(filename);
    if (!from) return null;
    return { from, filename };
  }

  private static asBytes(value: unknown): Uint8Array | null {
    if (value instanceof Uint8Array) return value;
    if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) return null;
    return Uint8Array.from(value);
  }

  private static dataUrl(url: string): Uint8Array | null {
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    const meta = url.slice(0, comma);
    const data = url.slice(comma + 1);
    try {
      if (meta.includes(";base64")) return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
      return new TextEncoder().encode(decodeURIComponent(data));
    } catch {
      return null;
    }
  }
}

PageRescue.install();
