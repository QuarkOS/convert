export type PickerSurface = "popup" | "page";

export type PickerWindowOptions = {
  url: string;
  type: "popup";
  width: number;
  height: number;
  focused: boolean;
};

export type PickerApi = {
  getURL: (path: string) => string;
  createWindow?: (options: PickerWindowOptions) => Promise<unknown>;
  createTab: (options: { url: string; active: boolean }) => Promise<unknown>;
  close: () => void;
};

export class PickerLaunch {
  static readonly page = "popup.html";
  static readonly flag = "picker";
  static readonly width = 420;
  static readonly height = 560;

  static surface(search: string): PickerSurface {
    return new URLSearchParams(search).has(PickerLaunch.flag) ? "page" : "popup";
  }

  static path(): string {
    return `${PickerLaunch.page}?${PickerLaunch.flag}=1`;
  }

  static windowOptions(url: string): PickerWindowOptions {
    return { url, type: "popup", width: PickerLaunch.width, height: PickerLaunch.height, focused: true };
  }

  static async open(api: PickerApi): Promise<"window" | "tab"> {
    const url = api.getURL(PickerLaunch.path());
    let opened: "window" | "tab" = "tab";
    if (api.createWindow) {
      try {
        await api.createWindow(PickerLaunch.windowOptions(url));
        opened = "window";
      } catch {
        await api.createTab({ url, active: true });
      }
    } else {
      await api.createTab({ url, active: true });
    }
    api.close();
    return opened;
  }

  static browserApi(): PickerApi {
    const windows = typeof chrome.windows?.create === "function" ? chrome.windows : null;
    return {
      getURL: (path) => chrome.runtime.getURL(path),
      createWindow: windows ? (options) => windows.create(options) : undefined,
      createTab: (options) => chrome.tabs.create(options),
      close: () => window.close(),
    };
  }
}
