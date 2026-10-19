import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, rmSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { FirefoxPack } from "./firefox-pack.ts";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const pages = resolve(root, "fixtures/pages");
const images = resolve(root, "../core/fixtures/images");
const out = "/tmp/convert-menu-shots";
const port = 43128;

await mkdir(out, { recursive: true });

async function chromeShot() {
  const browser = await puppeteer.launch({
    executablePath: chromeExecutable(),
    headless: false,
    enableExtensions: true,
    defaultViewport: { width: 1100, height: 700 },
    env: { ...process.env, DISPLAY: ":1" },
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-position=30,30",
      "--window-size=1100,760",
    ],
  });
  try {
    const worker = await browser.waitForTarget((target) => target.type() === "service_worker", { timeout: 8000 });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/accept.html`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#sample");
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
    const point = await clickPoint(page);
    await realRightClick(point.x, point.y);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
    const shot = join(out, "chrome-context-menu.png");
    await rootShot(shot);
    return { worker: worker.url(), point, shot };
  } finally {
    await browser.close();
  }
}

async function firefoxShot() {
  const bin = firefoxExecutable();
  if (!bin) return { error: "Firefox binary was not found", command: "find /tmp/puppeteer-browsers/firefox -name firefox" };
  const version = await commandOutput(bin, ["--version"]);
  const profile = "/tmp/convert-firefox-profile";
  rmSync(profile, { recursive: true, force: true });
  await mkdir(profile, { recursive: true });
  const firefoxDist = await FirefoxPack.write(dist, join(out, "firefox-ext"));
  const child = spawn(bin, ["-marionette", "-profile", profile, "-no-remote", "-width", "1100", "-height", "760"], {
    env: { ...process.env, DISPLAY: ":1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  try {
    const portFile = join(profile, "MarionetteActivePort");
    const marionettePort = Number(await waitForFile(portFile));
    const session = await MarionetteClient.connect(marionettePort);
    const installed = await session.request("Addon:Install", { path: firefoxDist, temporary: true });
    await session.request("WebDriver:Navigate", { url: `http://127.0.0.1:${port}/accept.html` });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
    const point = await session.request("WebDriver:ExecuteScript", {
      script: `const img = document.querySelector("#sample");
        const rect = img.getBoundingClientRect();
        return {
          x: window.screenX + (window.outerWidth - window.innerWidth) + rect.x + rect.width / 2,
          y: window.screenY + (window.outerHeight - window.innerHeight) + rect.y + rect.height / 2
        };`,
      args: [],
    });
    const value = point.value ?? point;
    await realRightClick(Math.round(value.x), Math.round(value.y));
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 800));
    const shot = join(out, "firefox-context-menu.png");
    await rootShot(shot);
    const about = join(out, "firefox-window.png");
    await rootShot(about);
    return { installed, point: value, shot, about, version, bin, stderr: stderr.slice(-500) };
  } catch (error) {
    const shot = join(out, "firefox-error.png");
    await rootShot(shot).catch(() => {});
    return {
      error: error instanceof Error ? error.message : String(error),
      stderr: stderr.slice(-800),
      shot,
      version,
      bin,
    };
  } finally {
    child.kill("SIGKILL");
  }
}

async function clickPoint(page) {
  const box = await page.$eval("#sample", (element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  const origin = await page.evaluate(() => ({
    x: window.screenX + (window.outerWidth - window.innerWidth),
    y: window.screenY + (window.outerHeight - window.innerHeight),
  }));
  return { x: Math.round(origin.x + box.x), y: Math.round(origin.y + box.y) };
}

function realRightClick(x, y) {
  return run("xdotool", ["mousemove", "--sync", String(x), String(y), "click", "3"], { DISPLAY: ":1" });
}

function rootShot(file) {
  return run("import", ["-window", "root", file], { DISPLAY: ":1" });
}

function commandOutput(command, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args);
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      text += chunk.toString();
    });
    child.on("exit", () => resolvePromise(text.trim()));
  });
}

function run(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env } });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise(undefined);
      else reject(new Error(`${command} exited ${code}: ${stderr}`));
    });
  });
}

function listen() {
  const types = new Map([
    [".html", "text/html; charset=utf-8"],
    [".png", "image/png"],
    [".webp", "image/webp"],
  ]);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const image = url.pathname.startsWith("/images/");
    const base = image ? images : pages;
    const name = image ? url.pathname.slice("/images/".length) : url.pathname === "/" ? "accept.html" : url.pathname.slice(1);
    const file = normalize(join(base, name));
    if (!file.startsWith(base)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { "content-type": types.get(extname(file)) ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(port, "127.0.0.1", () => resolvePromise(server));
  });
}

function chromeExecutable() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const root = "/tmp/puppeteer-browsers/chrome";
  const version = readdirSync(root).find((name) => name.startsWith("linux-"));
  return `${root}/${version}/chrome-linux64/chrome`;
}

function firefoxExecutable() {
  const root = "/tmp/puppeteer-browsers/firefox";
  if (!existsSync(root)) return "";
  for (const version of readdirSync(root)) {
    const bin = join(root, version, "firefox", "firefox");
    if (existsSync(bin)) return bin;
  }
  return "";
}

async function waitForFile(file) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (existsSync(file)) {
      const text = (await readFile(file, "utf8")).trim();
      if (text) return text;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${file}`);
}

class MarionetteClient {
  static async connect(port) {
    const socket = net.connect({ host: "127.0.0.1", port });
    await new Promise((resolvePromise, reject) => {
      socket.once("connect", resolvePromise);
      socket.once("error", reject);
    });
    const client = new MarionetteClient(socket);
    await client.hello();
    await client.request("WebDriver:NewSession", {
      capabilities: { alwaysMatch: { browserName: "firefox", acceptInsecureCerts: true } },
    });
    return client;
  }

  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.nextId = 1;
    this.waiters = [];
    this.parsing = false;
    socket.on("data", (chunk) => {
      this.buffer += chunk.toString();
      if (this.parsing) this.drain();
    });
  }

  async hello() {
    await this.takeMessage();
    this.parsing = true;
    this.drain();
  }

  request(name, params) {
    const id = this.nextId;
    this.nextId += 1;
    const body = JSON.stringify([0, id, name, params]);
    this.socket.write(`${Buffer.byteLength(body)}:${body}`);
    return new Promise((resolvePromise, reject) => {
      this.waiters.push({ id, resolve: resolvePromise, reject });
    });
  }

  takeMessage() {
    return new Promise((resolvePromise, reject) => {
      const started = Date.now();
      const pull = () => {
        if (!this.buffer.includes(":")) {
          if (Date.now() - started > 10000) {
            this.socket.off("data", pull);
            reject(new Error("Timed out waiting for Marionette"));
            return;
          }
          return;
        }
        const colon = this.buffer.indexOf(":");
        const length = Number(this.buffer.slice(0, colon));
        if (!Number.isFinite(length) || this.buffer.length < colon + 1 + length) return;
        const body = this.buffer.slice(colon + 1, colon + 1 + length);
        this.buffer = this.buffer.slice(colon + 1 + length);
        this.socket.off("data", pull);
        resolvePromise(body);
      };
      this.socket.on("data", pull);
      pull();
    });
  }

  drain() {
    while (this.buffer.includes(":")) {
      const colon = this.buffer.indexOf(":");
      const length = Number(this.buffer.slice(0, colon));
      if (!Number.isFinite(length) || this.buffer.length < colon + 1 + length) return;
      const body = this.buffer.slice(colon + 1, colon + 1 + length);
      this.buffer = this.buffer.slice(colon + 1 + length);
      const message = JSON.parse(body);
      if (!Array.isArray(message) || message[0] !== 1) continue;
      const waiter = this.waiters.find((item) => item.id === message[1]);
      if (!waiter) continue;
      this.waiters = this.waiters.filter((item) => item !== waiter);
      if (message[2]) waiter.reject(new Error(JSON.stringify(message[2])));
      else waiter.resolve(message[3]);
    }
  }
}

const server = await listen();
const report = { chrome: null, firefox: null };
const only = process.argv[2] ?? "all";
try {
  if (only !== "firefox") report.chrome = await chromeShot();
  if (only !== "chrome") report.firefox = await firefoxShot();
  await writeFile(join(out, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  server.close();
}
