export type ExtensionPrefs = {
  globalEnabled: boolean;
  disabledOrigins: string[];
};

export class ExtensionSettings {
  static async read(): Promise<ExtensionPrefs> {
    const stored = await chrome.storage.local.get({
      globalEnabled: true,
      disabledOrigins: [],
    });
    const raw = stored.disabledOrigins;
    const disabledOrigins = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
    return { globalEnabled: stored.globalEnabled !== false, disabledOrigins };
  }

  static allows(prefs: ExtensionPrefs, origin: string): boolean {
    return prefs.globalEnabled && !prefs.disabledOrigins.includes(origin);
  }

  static async setGlobal(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ globalEnabled: enabled });
  }

  static async setOrigin(origin: string, enabled: boolean): Promise<void> {
    const prefs = await ExtensionSettings.read();
    const disabledOrigins = enabled
      ? prefs.disabledOrigins.filter((item) => item !== origin)
      : [...new Set([...prefs.disabledOrigins, origin])];
    await chrome.storage.local.set({ disabledOrigins });
  }
}
