export class PopupChrome {
  static apply(view: "idle" | "success", body: HTMLElement): void {
    body.dataset.view = view;
  }
}

export class PopupResult {
  static place(): string {
    return "Downloads";
  }

  static route(sourceName: string, outputName: string): { source: string; output: string } {
    return { source: sourceName, output: outputName };
  }

  static line(outputName: string, elapsedMs: number, place: string): string {
    return `Saved ${outputName} to ${place} in ${elapsedMs} ms.`;
  }
}
