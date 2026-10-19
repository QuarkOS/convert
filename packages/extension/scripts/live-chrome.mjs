import { existsSync, readdirSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
const shots = resolve(root, "../../media");
const storeMedia = "/cursor/stores/bc-832b33f9-448b-504d-a1df-257dd2fca0a0/media";
const downloads = "/tmp/convert-downloads";
const png = resolve(root, "../core/fixtures/images/red.png");
const webp = resolve(root, "../core/fixtures/images/red.webp");
const port = process.env.PORT ?? "43127";

await mkdir(shots, { recursive: true });
await mkdir(storeMedia, { recursive: true });
await mkdir(downloads, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromeExecutable(),
  headless: false,
  enableExtensions: true,
  defaultViewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${dist}`,
    `--load-extension=${dist}`,
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--window-size=1280,800`,
  ],
});

const report = { lanes: {}, samples: [] };

try {
  const extensionId = await waitForExtension(browser);
  report.extensionId = extensionId;
  const popup = await browser.newPage();
  await allowDownloads(popup);
  await popup.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: "domcontentloaded" });
  const file = await popup.$("#file");
  if (!file) throw new Error("Popup has no file input");
  await file.uploadFile(png);
  await popup.waitForSelector("[data-target='jpg']");
  const labels = await popup.$$eval("[data-target]", (nodes) => nodes.map((node) => node.textContent ?? ""));
  report.lanes["1"] = { labels };
  await save(popup, "ext-lane-1.png");
  if (!labels.includes(".jpg") || labels.includes(".heic") || labels.includes(".mp3")) {
    throw new Error(`Popup targets are wrong: ${labels.join(",")}`);
  }

  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    await popup.evaluate(() => {
      const status = document.querySelector("#status");
      if (status) status.textContent = "";
    });
    await popup.click("[data-target='jpg']");
    await popup.waitForFunction(() => (document.querySelector("#status")?.textContent ?? "").startsWith("Saved"), {
      timeout: 5000,
    });
    const elapsed = await popup.$eval("#status", (node) => Number(node.dataset.elapsed ?? "0"));
    samples.push(elapsed);
    if (elapsed > 5000) throw new Error(`Conversion took ${elapsed} ms`);
  }
  report.samples = samples;
  await save(popup, "ext-lane-2.png");
  const jpeg = await newestDownload();
  const magic = (await readFile(jpeg)).subarray(0, 3);
  report.lanes["2"] = { jpeg, magic: [...magic], samples };
  if (magic[0] !== 0xff || magic[1] !== 0xd8 || magic[2] !== 0xff) {
    throw new Error(`Download is not a jpeg: ${jpeg}`);
  }

  const accept = await browser.newPage();
  await accept.goto(`http://127.0.0.1:${port}/accept.html`, { waitUntil: "networkidle0" });
  await accept.waitForSelector("html[data-convert-ready='1']");
  await accept.waitForSelector("#sample");
  await accept.click("#sample", { button: "right" });
  await accept.waitForSelector("#convert-rescue-host");
  const menu = await shadowText(accept);
  report.lanes["3"] = { menu };
  await save(accept, "ext-lane-3.png");
  if (!menu.includes("Convert to") || menu.includes(".heic") || menu.includes(".mp3")) {
    throw new Error(`Context menu is wrong: ${menu}`);
  }

  await accept.keyboard.press("Escape");
  const photo = await accept.$("#photo");
  if (!photo) throw new Error("Missing photo input");
  await photo.uploadFile(webp);
  await accept.waitForSelector("#convert-rescue-host");
  const toast = await shadowText(accept);
  report.lanes["4"] = { toast };
  await save(accept, "ext-lane-4.png");
  if (!toast.includes(".webp") || !toast.includes(".jpg") || toast.includes(".heic")) {
    throw new Error(`Accept toast is wrong: ${toast}`);
  }
  await clickShadow(accept, "[data-target='jpg']");
  await accept.waitForFunction(() => (document.querySelector("#status")?.textContent ?? "").startsWith("Accepted"), {
    timeout: 5000,
  });
  const accepted = await accept.$eval("#status", (node) => node.textContent ?? "");
  report.lanes["5"] = { accepted };
  await save(accept, "ext-lane-5.png");
  if (!/\.jpe?g/.test(accepted) || !accepted.includes("image/jpeg")) {
    throw new Error(`Page did not accept the jpeg: ${accepted}`);
  }

  const reject = await browser.newPage();
  await reject.goto(`http://127.0.0.1:${port}/reject.html`, { waitUntil: "networkidle0" });
  await reject.waitForSelector("html[data-convert-ready='1']");
  const upload = await reject.$("#upload");
  if (!upload) throw new Error("Missing upload input");
  await upload.uploadFile(webp);
  await reject.waitForSelector("#convert-rescue-host", { timeout: 4000 });
  const rejection = await shadowText(reject);
  report.lanes["6"] = { rejection };
  await save(reject, "ext-lane-6.png");
  if (!rejection.includes("Unsupported") && !rejection.includes(".webp")) {
    throw new Error(`Rejection toast is wrong: ${rejection}`);
  }
  await clickShadow(reject, "[data-convert-mute='site']");
  await reject.waitForFunction(() => !document.querySelector("#convert-rescue-host"));
  await reject.evaluate(() => {
    const input = document.querySelector("#upload");
    if (input instanceof HTMLInputElement) input.value = "";
  });
  await upload.uploadFile(webp);
  await reject.waitForFunction(() => (document.querySelector("#alert")?.textContent ?? "").includes("Unsupported"), {
    timeout: 4000,
  });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  const muted = await reject.$("#convert-rescue-host");
  report.lanes["7"] = { toastAfterMute: Boolean(muted) };
  await save(reject, "ext-lane-7.png");
  if (muted) throw new Error("Toast appeared after the site was turned off");

  await popup.bringToFront();
  await popup.click("#global-enabled");
  const globalOn = await popup.$eval("#global-enabled", (node) => node.checked);
  if (globalOn) throw new Error("Global switch did not turn off");
  const second = await browser.newPage();
  await second.goto(`http://localhost:${port}/reject.html`, { waitUntil: "networkidle0" });
  await second.waitForSelector("html[data-convert-ready='1']");
  const secondUpload = await second.$("#upload");
  if (!secondUpload) throw new Error("Missing second upload input");
  await secondUpload.uploadFile(webp);
  await second.waitForFunction(() => (document.querySelector("#alert")?.textContent ?? "").includes("Unsupported"), {
    timeout: 4000,
  });
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 400));
  const globalToast = await second.$("#convert-rescue-host");
  report.lanes["8"] = { origin: second.url(), toast: Boolean(globalToast) };
  await save(second, "ext-lane-8.png");
  if (globalToast) throw new Error("Toast appeared while the global switch was off");

  await popup.bringToFront();
  await popup.click("#global-enabled");
  const restored = await tryPublicSite(browser, jpeg);
  report.lanes["9"] = restored;
  report.lanes["10"] = { firefox: "not-installed" };

  await writeFile(join(shots, "extension-live.json"), `${JSON.stringify(report, null, 2)}\n`);
  await copyShots(shots, storeMedia);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}

function chromeExecutable() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const root = "/tmp/puppeteer-browsers/chrome";
  if (existsSync(root)) {
    const version = readdirSync(root).find((name) => name.startsWith("linux-"));
    const bin = version ? `${root}/${version}/chrome-linux64/chrome` : "";
    if (bin && existsSync(bin)) return bin;
  }
  return "/usr/local/bin/google-chrome";
}

async function waitForExtension(browser) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    const target = browser.targets().find((item) => item.url().startsWith("chrome-extension://"));
    if (target) return new URL(target.url()).host;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  const seen = browser.targets().map((item) => `${item.type()} ${item.url()}`).join(" | ");
  throw new Error(`Chrome did not load the extension. Targets: ${seen}`);
}

async function allowDownloads(page) {
  const session = await page.createCDPSession();
  await session.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
}

async function newestDownload() {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const names = (await readdir(downloads)).filter((name) => !name.endsWith(".crdownload"));
    if (names.length > 0) return join(downloads, names.sort().at(-1) ?? names[0]);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("No download started within 5000 ms");
}

async function shadowText(page) {
  return page.evaluate(() => {
    const host = document.querySelector("#convert-rescue-host");
    return host?.shadowRoot?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  });
}

async function clickShadow(page, selector) {
  const clicked = await page.evaluate((target) => {
    const host = document.querySelector("#convert-rescue-host");
    const button = host?.shadowRoot?.querySelector(target);
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  }, selector);
  if (!clicked) throw new Error(`Missing shadow control ${selector}`);
}

async function save(page, name) {
  const repoPath = join(shots, name);
  await page.screenshot({ path: repoPath });
}

async function copyShots(from, to) {
  const names = (await readdir(from)).filter((name) => name.endsWith(".png") || name.endsWith(".json"));
  for (const name of names) {
    await writeFile(join(to, name), await readFile(join(from, name)));
  }
}

async function tryPublicSite(browser, jpegPath) {
  const page = await browser.newPage();
  try {
    await page.goto("https://catbox.moe", { waitUntil: "domcontentloaded", timeout: 20000 });
    const input = await page.$("input[type='file']");
    if (!input) return { site: "https://catbox.moe", accepted: false, reason: "no file input" };
    await input.uploadFile(jpegPath);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
    const shown = await page.evaluate(() => {
      const field = document.querySelector("input[type='file']");
      const fromInput = field instanceof HTMLInputElement && field.files?.[0] ? `${field.files[0].name} ${field.files[0].type}` : "";
      const visible = document.body.innerText.includes("red.jpg") ? "red.jpg visible in the page" : "";
      return [fromInput, visible].filter(Boolean).join("; ");
    });
    await save(page, "ext-lane-9.png");
    return {
      site: page.url(),
      shown,
      accepted: shown.includes("red.jpg") || shown.includes("image/jpeg"),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "public site failed";
    return { site: "https://catbox.moe", accepted: false, reason: message };
  } finally {
    await page.close();
  }
}
