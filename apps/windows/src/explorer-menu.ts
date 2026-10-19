import path from "node:path";
import { FormatCatalog, FormatGraph, type Engine, type FormatId } from "@convert/core";

export type MenuEntry = {
  extension: string;
  extensions: string[];
  from: FormatId;
  targets: FormatId[];
};

export class ExplorerMenu {
  static entries(engines: readonly Engine[]): MenuEntry[] {
    const edges = FormatGraph.compile(engines);
    const rows: MenuEntry[] = [];
    for (const id of FormatCatalog.ids()) {
      const targets = ExplorerMenu.sameFamily(id, FormatGraph.targets(edges, id));
      if (targets.length === 0) continue;
      const record = FormatCatalog.get(id);
      rows.push({
        extension: record.extension,
        extensions: [record.extension, ...record.aliases],
        from: id,
        targets,
      });
    }
    return rows;
  }

  static shared(files: readonly string[], engines: readonly Engine[]): FormatId[] {
    const edges = FormatGraph.compile(engines);
    let common: Set<FormatId> | null = null;
    for (const file of files) {
      const from = FormatCatalog.fromFilename(path.basename(file));
      if (!from) return [];
      const targets = new Set(ExplorerMenu.sameFamily(from, FormatGraph.targets(edges, from)));
      if (common === null) {
        common = targets;
      } else {
        const next = new Set<FormatId>();
        for (const id of common) {
          if (targets.has(id)) next.add(id);
        }
        common = next;
      }
    }
    const shared: FormatId[] = [];
    for (const id of common ?? []) shared.push(id);
    shared.sort((a, b) => a.localeCompare(b));
    return shared;
  }

  static sameFamily(from: FormatId, targets: readonly FormatId[]): FormatId[] {
    const family = FormatCatalog.family(from);
    if (family !== "image" && family !== "video") return [...targets];
    return targets.filter((id) => FormatCatalog.family(id) === family);
  }
}
