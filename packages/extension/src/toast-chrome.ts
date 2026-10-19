import type { FormatId } from "../../core/src/domain.ts";

export class ToastChrome {
  static formatClass(id: FormatId, targets: readonly FormatId[]): "filled" | "outline" {
    return targets[0] === id ? "filled" : "outline";
  }

  static originalClass(): "secondary" {
    return "secondary";
  }

  static muteClass(): "link" {
    return "link";
  }

  static muteLabel(): string {
    return "Never on this site";
  }
}
