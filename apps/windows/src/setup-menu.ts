import type { MenuEntry } from "./explorer-menu.ts";

export class SetupMenu {
  static install(entries: readonly MenuEntry[]): string {
    const lines: string[] = [];
    for (const entry of entries) {
      for (const ext of entry.extensions) {
        const key = `Software\\Classes\\SystemFileAssociations\\.${ext}\\shell\\ConvertTo`;
        lines.push(`; menu ${ext}`);
        lines.push(`WriteRegStr HKCU "${key}" "MUIVerb" "Convert to"`);
        lines.push(`WriteRegStr HKCU "${key}" "SubCommands" ""`);
        for (const target of entry.targets) {
          const verb = `${key}\\shell\\${target}`;
          lines.push(`WriteRegStr HKCU "${verb}" "MUIVerb" ".${target}"`);
          lines.push(
            `WriteRegStr HKCU "${verb}\\command" "" "$\\"$INSTDIR\\Convert.cmd$\\" --to ${target} $\\"%1$\\""`,
          );
        }
      }
    }
    return `${lines.join("\n")}\n`;
  }

  static uninstall(entries: readonly MenuEntry[]): string {
    const lines: string[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      for (const ext of entry.extensions) {
        if (seen.has(ext)) continue;
        seen.add(ext);
        lines.push(`DeleteRegKey HKCU "Software\\Classes\\SystemFileAssociations\\.${ext}\\shell\\ConvertTo"`);
      }
    }
    return `${lines.join("\n")}\n`;
  }

  static block(script: string, extension: string): string {
    const marker = `; menu ${extension}\n`;
    const start = script.indexOf(marker);
    if (start < 0) return "";
    const next = script.indexOf("\n; menu ", start + marker.length);
    return next < 0 ? script.slice(start) : script.slice(start, next);
  }
}
