import { ConversionError, type FormatId } from "../domain.ts";
import { Pairs } from "../pairs.ts";
import { BinaryProbe, ProcessRun, TempDir } from "../process-run.ts";

const DOCS = ["docx", "md", "html", "txt", "odt", "rtf"] as const satisfies readonly FormatId[];

const PANDOC_NAME: Record<(typeof DOCS)[number], string> = {
  docx: "docx",
  md: "markdown",
  html: "html",
  txt: "plain",
  odt: "odt",
  rtf: "rtf",
};

export class PandocEngine {
  static readonly id = "pandoc";

  static available(): boolean {
    return BinaryProbe.has("pandoc");
  }

  static edges(): { from: FormatId; to: FormatId }[] {
    return Pairs.directed(DOCS);
  }

  static async convert(input: Uint8Array, from: FormatId, to: FormatId): Promise<Uint8Array> {
    const fromName = PandocEngine.pandocName(from, "from");
    const toName = PandocEngine.pandocName(to, "to");
    return TempDir.use(async (dir) => {
      const source = await TempDir.write(dir, `in.${from}`, input);
      const target = `${dir}/out.${to}`;
      await ProcessRun.exec("pandoc", ["-f", fromName, "-t", toName, "-o", target, source]);
      return TempDir.read(target);
    });
  }

  private static pandocName(id: FormatId, direction: "from" | "to"): string {
    if (id === "txt") return direction === "from" ? "markdown" : "plain";
    if (id === "docx" || id === "md" || id === "html" || id === "odt" || id === "rtf") {
      return PANDOC_NAME[id];
    }
    throw new ConversionError("engine-failed", `pandoc cannot handle ${id}`);
  }
}
