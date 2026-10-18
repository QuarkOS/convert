import path from "node:path";
import { fileURLToPath } from "node:url";
import { FormatCatalog } from "@convert/core";
import { NodeEngines } from "@convert/core/node";
import { BatchConvert } from "./batch-convert.ts";
import { ExplorerMenu } from "./explorer-menu.ts";

export class ConvertHost {
  static async main(argv: readonly string[]): Promise<number> {
    if (argv.includes("--menu")) {
      process.stdout.write(`${JSON.stringify(ExplorerMenu.entries(NodeEngines.bundled()))}\n`);
      return 0;
    }
    const toFlag = argv.indexOf("--to");
    const skip = new Set<number>();
    if (toFlag >= 0) skip.add(toFlag + 1);
    const files = argv.filter((arg, index) => !arg.startsWith("--") && !skip.has(index));
    if (files.length === 0) {
      process.stdout.write("No file is selected.\n");
      return 2;
    }
    if (argv.includes("--targets")) {
      process.stdout.write(`${JSON.stringify(ExplorerMenu.shared(files, NodeEngines.bundled()))}\n`);
      return 0;
    }
    const to = toFlag >= 0 ? FormatCatalog.parse(argv[toFlag + 1] ?? "") : null;
    if (!to) {
      process.stderr.write("Name a target with --to.\n");
      return 2;
    }
    const started = Date.now();
    const items = await BatchConvert.run({ files, to, engines: NodeEngines.bundled() });
    for (const item of items) {
      if (item.ok) process.stdout.write(`${item.output}\n`);
      else process.stderr.write(`${item.source}: ${item.message}\n`);
    }
    process.stderr.write(`elapsed ${Date.now() - started} ms\n`);
    return items.every((item) => item.ok) ? 0 : 1;
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && fileURLToPath(import.meta.url) === entry) {
  ConvertHost.main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : "Convert failed";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    },
  );
}
