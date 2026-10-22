import { ConversionJob } from "../../core/src/conversion-job.ts";
import type { FormatId } from "../../core/src/domain.ts";
import { FormatCatalog } from "../../core/src/format-catalog.ts";
import { FormatGraph } from "../../core/src/format-graph.ts";
import { FileDownload } from "./files.ts";
import { PopupEngines } from "./popup-engines.ts";
import { PickerLaunch } from "./picker-launch.ts";
import { PopupChrome, PopupResult } from "./popup-result.ts";
import { ExtensionSettings } from "./settings.ts";

class Popup {
  static async main(): Promise<void> {
    const globalBox = Popup.required<HTMLInputElement>("#global-enabled");
    const siteBox = Popup.required<HTMLInputElement>("#site-enabled");
    const siteLabel = Popup.required<HTMLElement>("#site-label");
    const siteRow = Popup.required<HTMLElement>("#site-row");
    const drop = Popup.required<HTMLElement>("#drop");
    const picker = Popup.required<HTMLInputElement>("#file");
    const surface = PickerLaunch.surface(location.search);
    document.body.dataset.surface = surface;
    PopupChrome.apply("idle", document.body);
    const prefs = await ExtensionSettings.read();
    globalBox.checked = prefs.globalEnabled;
    globalBox.addEventListener("change", () => {
      void ExtensionSettings.setGlobal(globalBox.checked);
    });

    const origin = await Popup.activeOrigin();
    if (!origin) {
      siteRow.hidden = true;
    } else {
      siteLabel.textContent = `Offer on ${origin}`;
      siteBox.checked = !prefs.disabledOrigins.includes(origin);
      siteBox.addEventListener("change", () => {
        void ExtensionSettings.setOrigin(origin, siteBox.checked);
      });
    }

    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      if (file) void Popup.showFile(file);
    });
    drop.addEventListener("dragover", (event) => {
      event.preventDefault();
      drop.classList.add("hot");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("hot"));
    drop.addEventListener("drop", (event) => {
      event.preventDefault();
      drop.classList.remove("hot");
      const file = event.dataTransfer?.files?.[0];
      if (file) void Popup.showFile(file);
    });
    drop.addEventListener("click", (event) => {
      if (surface === "popup") {
        // A native file dialog steals focus and Chrome and Firefox close the popup, losing the file.
        // Choosing a file therefore happens in a small extension window that stays open.
        event.preventDefault();
        if (drop.classList.contains("again")) {
          Popup.presentIdle();
          return;
        }
        void PickerLaunch.open(PickerLaunch.browserApi());
        return;
      }
      if (!drop.classList.contains("again")) return;
      Popup.presentIdle();
    });
  }

  private static presentIdle(): void {
    PopupChrome.apply("idle", document.body);
    Popup.required<HTMLElement>("#success").hidden = true;
    Popup.required<HTMLElement>("#drop").classList.remove("again");
    Popup.required<HTMLElement>("#prompt").textContent = "Drop a file, or choose one.";
    Popup.required<HTMLElement>("#filename").hidden = true;
    Popup.required<HTMLElement>("#targets").hidden = true;
  }

  private static async showFile(file: File): Promise<void> {
    const filename = Popup.required<HTMLElement>("#filename");
    const targets = Popup.required<HTMLElement>("#targets");
    const status = Popup.required<HTMLElement>("#status");
    const success = Popup.required<HTMLElement>("#success");
    const drop = Popup.required<HTMLElement>("#drop");
    const prompt = Popup.required<HTMLElement>("#prompt");
    PopupChrome.apply("idle", document.body);
    success.hidden = true;
    drop.classList.remove("again");
    prompt.textContent = "Drop a file, or choose one.";
    filename.hidden = false;
    targets.hidden = false;
    filename.textContent = file.name;
    targets.replaceChildren();
    status.classList.remove("error", "done");
    const from = FormatCatalog.fromFilename(file.name);
    if (!from) {
      status.textContent = "Convert does not recognize that file type.";
      status.classList.add("error");
      return;
    }
    const offered = FormatGraph.targets(FormatGraph.compile(PopupEngines.list()), from);
    if (offered.length === 0) {
      status.textContent = `No conversion from .${FormatCatalog.extension(from)} in the extension.`;
      status.classList.add("error");
      return;
    }
    status.textContent = "Choose a type.";
    for (const to of offered) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.target = to;
      button.setAttribute("aria-pressed", "false");
      button.textContent = `.${FormatCatalog.extension(to)}`;
      button.addEventListener("click", () => {
        for (const other of targets.querySelectorAll("button")) {
          other.setAttribute("aria-pressed", other === button ? "true" : "false");
        }
        void Popup.convert(file, from, to, button);
      });
      targets.append(button);
    }
  }

  private static async convert(file: File, from: FormatId, to: FormatId, button: HTMLButtonElement): Promise<void> {
    const status = Popup.required<HTMLElement>("#status");
    const started = performance.now();
    button.disabled = true;
    status.classList.remove("error");
    status.textContent = `Converting to .${FormatCatalog.extension(to)}…`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ConversionJob.run({ bytes, from, to, engines: PopupEngines.list() });
    button.disabled = false;
    if (!result.ok) {
      status.textContent = result.message;
      status.classList.add("error");
      return;
    }
    const name = FormatCatalog.rename(file.name, to);
    FileDownload.save(name, result.bytes, FormatCatalog.mediaType(to));
    const elapsed = Math.round(performance.now() - started);
    const place = PopupResult.place();
    const route = PopupResult.route(file.name, name);
    const line = PopupResult.line(name, elapsed, place);
    Popup.required<HTMLElement>("#success-from").textContent = route.source;
    Popup.required<HTMLElement>("#success-to").textContent = route.output;
    Popup.required<HTMLElement>("#success-format").textContent = `.${FormatCatalog.extension(to)}`;
    Popup.required<HTMLElement>("#success-line").textContent = line;
    PopupChrome.apply("success", document.body);
    Popup.required<HTMLElement>("#success").hidden = false;
    Popup.required<HTMLElement>("#filename").hidden = true;
    Popup.required<HTMLElement>("#targets").hidden = true;
    const drop = Popup.required<HTMLElement>("#drop");
    drop.classList.add("again");
    Popup.required<HTMLElement>("#prompt").textContent = "Convert another";
    status.dataset.elapsed = String(elapsed);
    status.dataset.place = place;
    status.textContent = line;
    status.classList.add("done");
  }

  private static async activeOrigin(): Promise<string | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tabs[0]?.url;
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.origin;
    } catch {
      return null;
    }
  }

  private static required<T extends Element>(selector: string): T {
    const node = document.querySelector(selector);
    if (!node) throw new Error(`Missing ${selector}`);
    return node as T;
  }
}

void Popup.main();
