import type { FormatId } from "../../core/src/domain.ts";
import { FormatCatalog } from "../../core/src/format-catalog.ts";

export type RescueDecision = {
  show: boolean;
  from: FormatId | null;
  targets: FormatId[];
  message: string;
};

const TYPE_ERROR =
  /unsupported|not supported|invalid file|file type|not allowed|wrong type|only accepts|must be|does not accept|doesn't accept/i;

export class AcceptList {
  static formats(accept: string): { ids: Set<FormatId>; families: Set<string>; unconstrained: boolean } {
    const trimmed = accept.trim();
    if (!trimmed || trimmed === "*/*") {
      return { ids: new Set(), families: new Set(), unconstrained: true };
    }
    const ids = new Set<FormatId>();
    const families = new Set<string>();
    for (const part of trimmed.split(",")) {
      const token = part.trim().toLowerCase();
      if (!token) continue;
      if (token === "*/*") return { ids: new Set(), families: new Set(), unconstrained: true };
      if (token.endsWith("/*")) {
        families.add(token.slice(0, -2));
        continue;
      }
      const id = FormatCatalog.parse(token.startsWith(".") ? token.slice(1) : token);
      if (id) ids.add(id);
    }
    return { ids, families, unconstrained: false };
  }

  static mentioned(text: string): Set<FormatId> {
    const found = new Set<FormatId>();
    for (const match of text.matchAll(/\.([a-z0-9]{2,5})\b/gi)) {
      const id = FormatCatalog.parse(match[1] ?? "");
      if (id) found.add(id);
    }
    for (const match of text.matchAll(/\b([a-z0-9]{2,12})\b/gi)) {
      const id = FormatCatalog.parse(match[1] ?? "");
      if (id) found.add(id);
    }
    return found;
  }

  static allowsFile(accept: string, filename: string): boolean {
    const parsed = AcceptList.formats(accept);
    if (parsed.unconstrained) return true;
    const id = FormatCatalog.fromFilename(filename);
    if (!id) return false;
    if (parsed.ids.has(id)) return true;
    return parsed.families.has(FormatCatalog.family(id));
  }

  static accepted(accept: string, extraText: string): { unconstrained: boolean; ids: Set<FormatId> } {
    const parsed = AcceptList.formats(accept);
    const ids = new Set<FormatId>(parsed.ids);
    for (const id of AcceptList.mentioned(extraText)) ids.add(id);
    if (parsed.families.size > 0) {
      for (const id of FormatCatalog.ids()) {
        if (parsed.families.has(FormatCatalog.family(id))) ids.add(id);
      }
    }
    return { unconstrained: parsed.unconstrained && ids.size === 0, ids };
  }
}

export class RescuePolicy {
  static fromAccept(input: {
    filename: string;
    accept: string;
    hintText: string;
    enabled: boolean;
    targets: readonly FormatId[];
  }): RescueDecision {
    return RescuePolicy.decide({
      filename: input.filename,
      accept: input.accept,
      extraText: input.hintText,
      enabled: input.enabled,
      targets: input.targets,
      requireConstraint: true,
      alertText: "",
    });
  }

  static fromRejection(input: {
    filename: string;
    accept: string;
    hintText: string;
    alertText: string;
    enabled: boolean;
    targets: readonly FormatId[];
  }): RescueDecision {
    if (!TYPE_ERROR.test(input.alertText)) {
      return RescuePolicy.empty(FormatCatalog.fromFilename(input.filename));
    }
    return RescuePolicy.decide({
      filename: input.filename,
      accept: input.accept,
      extraText: `${input.hintText}\n${input.alertText}`,
      enabled: input.enabled,
      targets: input.targets,
      requireConstraint: false,
      alertText: input.alertText,
    });
  }

  private static empty(from: FormatId | null): RescueDecision {
    return { show: false, from, targets: [], message: "" };
  }

  private static decide(input: {
    filename: string;
    accept: string;
    extraText: string;
    enabled: boolean;
    targets: readonly FormatId[];
    requireConstraint: boolean;
    alertText: string;
  }): RescueDecision {
    const from = FormatCatalog.fromFilename(input.filename);
    if (!input.enabled || !from) return RescuePolicy.empty(from);
    const accepted = AcceptList.accepted(input.accept, input.extraText);
    if (input.requireConstraint && accepted.unconstrained) return RescuePolicy.empty(from);
    if (!input.requireConstraint && accepted.ids.size === 0) return RescuePolicy.empty(from);
    if (accepted.ids.has(from)) return RescuePolicy.empty(from);
    const targets = input.targets.filter((id) => accepted.ids.has(id));
    if (targets.length === 0) return RescuePolicy.empty(from);
    const first = targets[0];
    if (!first) return RescuePolicy.empty(from);
    const label = `.${FormatCatalog.extension(from)}`;
    const next = `.${FormatCatalog.extension(first)}`;
    return {
      show: true,
      from,
      targets,
      message: `This site doesn't accept ${label}, convert to ${next}?`,
    };
  }
}
