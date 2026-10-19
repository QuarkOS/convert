import { execFileSync } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConversionError } from "./domain.ts";

export class BinaryProbe {
  private static readonly cache = new Map<string, boolean>();

  static has(command: string): boolean {
    const cached = BinaryProbe.cache.get(command);
    if (cached !== undefined) return cached;
    let found = false;
    try {
      const which = process.platform === "win32" ? "where" : "which";
      execFileSync(which, [command], { stdio: "ignore" });
      found = true;
    } catch {
      found = false;
    }
    BinaryProbe.cache.set(command, found);
    return found;
  }
}

export class ProcessRun {
  static async exec(command: string, args: readonly string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      execFile(command, [...args], { timeout: 60_000 }, (error, _stdout, stderr) => {
        if (error) {
          const detail = stderr.toString().trim().split("\n").slice(-4).join(" ");
          reject(new ConversionError("engine-failed", `${command} failed. ${detail}`));
          return;
        }
        resolve();
      });
    });
  }
}

export class TempDir {
  static async use<T>(fn: (dir: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(join(tmpdir(), "convert-"));
    try {
      return await fn(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  static async write(dir: string, name: string, bytes: Uint8Array): Promise<string> {
    const path = join(dir, name);
    await writeFile(path, bytes);
    return path;
  }

  static async read(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path));
  }
}
