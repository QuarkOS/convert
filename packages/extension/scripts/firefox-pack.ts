import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

type ExtensionManifest = {
  background?: {
    service_worker?: string;
    scripts?: string[];
    type?: string;
  };
};

export class FirefoxPack {
  static async write(source: string, target: string): Promise<string> {
    await rm(target, { recursive: true, force: true });
    await mkdir(target, { recursive: true });
    await cp(source, target, { recursive: true });
    const manifestPath = join(target, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as ExtensionManifest;
    const script = manifest.background?.service_worker ?? "background.js";
    manifest.background = { scripts: [script] };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return target;
  }
}
