import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { cp, lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { NodeEngines } from "@convert/core/node";
import { ExplorerMenu } from "../src/explorer-menu.ts";
import { SetupMenu } from "../src/setup-menu.ts";

class BundledRuntime {
  static readonly version = "v22.23.4";

  static async place(cacheDir: string, destExe: string): Promise<void> {
    const exe = path.join(cacheDir, `node-${BundledRuntime.version}-win-x64`, "node.exe");
    if (!(await BundledRuntime.isFile(exe))) {
      const zip = `${exe}.zip`;
      await mkdir(path.dirname(exe), { recursive: true });
      const url = `https://nodejs.org/dist/${BundledRuntime.version}/node-${BundledRuntime.version}-win-x64.zip`;
      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`Could not download ${url} (${response.status})`);
      await pipeline(response.body, createWriteStream(zip));
      await SetupBuild.run("unzip", ["-j", "-o", zip, `node-${BundledRuntime.version}-win-x64/node.exe`, "-d", path.dirname(exe)]);
    }
    const magic = (await readFile(exe)).subarray(0, 2);
    if (magic[0] !== 0x4d || magic[1] !== 0x5a) throw new Error("The bundled runtime is not a Windows executable");
    await mkdir(path.dirname(destExe), { recursive: true });
    await cp(exe, destExe);
  }

  static async isFile(file: string): Promise<boolean> {
    try {
      return (await lstat(file)).isFile();
    } catch {
      return false;
    }
  }
}

class SetupBuild {
  static async main(): Promise<void> {
    const windows = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
    const root = path.resolve(windows, "../..");
    const payload = "/home/ubuntu/convert-setup-payload";
    const entries = ExplorerMenu.entries(NodeEngines.bundled());
    await writeFile(path.join(windows, "setup-menu-install.nsh"), SetupMenu.install(entries));
    await writeFile(path.join(windows, "setup-menu-uninstall.nsh"), SetupMenu.uninstall(entries));
    await rm(payload, { recursive: true, force: true });
    await SetupBuild.copyTree(windows, path.join(payload, "apps/windows"), new Set([
      "setup-payload",
      "test",
      "launcher",
      "build",
      "scripts",
      "src",
      "Convert.nsi",
      "setup-menu-install.nsh",
      "setup-menu-uninstall.nsh",
      "pack-msix.ps1",
      "pack.ps1",
      "prove.ps1",
      "prove-ship.ps1",
      "desktop-capture.ps1",
      "capture-menu.ps1",
    ]));
    await cp(path.join(windows, "Convert.cmd"), path.join(payload, "Convert.cmd"));
    const corePackage = JSON.parse(await readFile(path.join(root, "packages/core/package.json"), "utf8")) as { dependencies: Record<string, string> };
    await writeFile(path.join(payload, "package.json"), `${JSON.stringify({
      name: "convert",
      private: true,
      dependencies: corePackage.dependencies,
    }, null, 2)}\n`);
    await esbuild.build({
      entryPoints: [path.join(windows, "src/host.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.join(payload, "apps/windows/host.mjs"),
      external: [
        "sharp",
        "exceljs",
        "fast-xml-parser",
        "heic-decode",
        "jszip",
        "pdf-lib",
        "pdfjs-dist",
        "pdfjs-dist/*",
        "smol-toml",
        "yaml",
      ],
    });
    await BundledRuntime.place(path.join(windows, "build"), path.join(payload, "runtime", "node.exe"));
    await SetupBuild.run("npm", [
      "install",
      "--omit=dev",
      "--os=win32",
      "--cpu=x64",
      "--no-fund",
      "--no-audit",
      "--ignore-scripts",
    ], payload);
    const sharp = path.join(payload, "node_modules", "@img", "sharp-win32-x64", "lib", "sharp-win32-x64.node");
    if (!(await BundledRuntime.isFile(sharp) && (await readFile(sharp)).length > 1000)) {
      throw new Error("Windows sharp was not installed into the setup payload");
    }
    if (await SetupBuild.present(path.join(payload, "node_modules", "@img", "sharp-linux-x64"))) {
      throw new Error("The setup payload included the Linux sharp binary");
    }
    await SetupBuild.materialize(path.join(payload, "node_modules"));
    const bundled = await readFile(path.join(payload, "apps/windows/host.mjs"), "utf8");
    if (!bundled.includes("\"sharp\"")) throw new Error("The bundled host did not keep sharp external");
    if (bundled.includes("node_modules/@convert/core")) {
      throw new Error("The bundled host still points at TypeScript inside node_modules");
    }
    await SetupBuild.run("makensis", [`-DPAYLOAD=${payload}`, "Convert.nsi"], windows);
  }

  private static async present(file: string): Promise<boolean> {
    try {
      await lstat(file);
      return true;
    } catch {
      return false;
    }
  }

  private static async copyTree(from: string, to: string, skip = new Set<string>()): Promise<void> {
    await mkdir(to, { recursive: true });
    for (const name of await readdir(from, { withFileTypes: true })) {
      if (name.name === "node_modules" || name.name === "dist" || name.name === "dist-firefox" || skip.has(name.name)) {
        continue;
      }
      if (name.name.startsWith("Convert-Setup-") && name.name.endsWith(".exe")) continue;
      const source = path.join(from, name.name);
      const dest = path.join(to, name.name);
      if (name.isDirectory()) await SetupBuild.copyTree(source, dest, skip);
      else await cp(source, dest);
    }
  }

  private static async materialize(dir: string): Promise<void> {
    for (const name of await readdir(dir)) {
      const full = path.join(dir, name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) {
        const target = await realpath(full);
        await rm(full);
        await cp(target, full, { recursive: true, dereference: true });
        const replaced = await lstat(full);
        if (replaced.isDirectory()) await SetupBuild.materialize(full);
      } else if (stat.isDirectory()) {
        await SetupBuild.materialize(full);
      }
    }
  }

  private static run(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${command} exited ${code}`));
      });
    });
  }
}

SetupBuild.main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "setup build failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
