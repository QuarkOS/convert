import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PopupResult } from "../src/popup-result.ts";
import { ToastChrome } from "../src/toast-chrome.ts";

const src = join(dirname(fileURLToPath(import.meta.url)), "../src");

test("the success line names the file and where it landed", () => {
  const route = PopupResult.route("red.png", "red.jpg");
  assert.equal(route.source, "red.png");
  assert.equal(route.output, "red.jpg");
  assert.notEqual(route.source, route.output);
  const line = PopupResult.line("red.jpg", 33, PopupResult.place());
  assert.equal(line, "Saved red.jpg to Downloads in 33 ms.");
  assert.match(line, /Downloads/);
  assert.match(line, /33 ms/);
});

test("the success view hides the offer row and the idle header", () => {
  const css = readFileSync(join(src, "popup.css"), "utf8");
  const html = readFileSync(join(src, "popup.html"), "utf8");
  assert.match(css, /body\[data-view="success"\] \.idle/);
  assert.match(html, /class="top idle"/);
  assert.match(html, /class="switch idle"/);
  assert.match(html, /class="switch idle" id="site-row"/);
});

test("the toast fills the recommended format and quiets the site mute", () => {
  assert.equal(ToastChrome.formatClass("png", ["png", "jpg"]), "filled");
  assert.equal(ToastChrome.formatClass("jpg", ["png", "jpg"]), "outline");
  assert.equal(ToastChrome.formatClass("jpg", ["jpg"]), "filled");
  assert.equal(ToastChrome.originalClass(), "secondary");
  assert.equal(ToastChrome.muteClass(), "link");
  assert.equal(ToastChrome.muteLabel(), "Never on this site");
});
