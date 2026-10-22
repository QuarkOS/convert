import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { NodeEngines } from "@convert/core/node";
import { ExplorerMenu } from "../src/explorer-menu.ts";
import { SetupMenu } from "../src/setup-menu.ts";

class SetupBuild {
  static async main(): Promise<void> {
    const windows = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
    const root = path.resolve(windows, "../..");
    const payload = path.join(windows, "setup-payload");
    const entries = ExplorerMenu.entries(NodeEngines.bundled());
    await writeFile(path.join(windows, "setup-menu-install.nsh"), SetupMenu.install(entries));
    await writeFile(path.join(windows, "setup-menu-uninstall.nsh"), SetupMenu.uninstall(entries));
    await rm(payload, { recursive: true, force: true });
    await SetupBuild.copyTree(path.join(root, "packages/core"), path.join(payload, "packages/core"));
    await SetupBuild.copyTree(path.join(root, "packages/extension"), path.join(payload, "packages/extension"));
    await SetupBuild.copyTree(windows, path.join(payload, "apps/windows"), new Set([
      "setup-payload",
      "test",
      "launcher",
      "build",
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
    await cp(path.join(root, "package.json"), path.join(payload, "package.json"));
    await cp(path.join(root, "package-lock.json"), path.join(payload, "package-lock.json"));
    await cp(path.join(windows, "Convert.cmd"), path.join(payload, "Convert.cmd"));
    await SetupBuild.run("makensis", ["Convert.nsi"], windows);
  }

  private static async copyTree(from: string, to: string, skip = new Set<string>()): Promise<void> {
    await mkdir(to, { recursive: true });
    for (const name of await readdir(from, { withFileTypes: true })) {
      if (name.name === "node_modules" || name.name === "dist" || name.name === "dist-firefox" || skip.has(name.name)) {
        continue;
      }
      const source = path.join(from, name.name);
      const dest = path.join(to, name.name);
      if (name.isDirectory()) await SetupBuild.copyTree(source, dest);
      else await cp(source, dest);
    }
  }

  private static run(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: "inherit" });
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
