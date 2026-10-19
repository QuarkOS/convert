import assert from "node:assert/strict";
import test from "node:test";
import { PopupResult } from "../src/popup-result.ts";
import { ToastChrome } from "../src/toast-chrome.ts";

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

test("the toast fills the recommended format and quiets the site mute", () => {
  assert.equal(ToastChrome.formatClass("png", ["png", "jpg"]), "filled");
  assert.equal(ToastChrome.formatClass("jpg", ["png", "jpg"]), "outline");
  assert.equal(ToastChrome.formatClass("jpg", ["jpg"]), "filled");
  assert.equal(ToastChrome.originalClass(), "secondary");
  assert.equal(ToastChrome.muteClass(), "link");
  assert.equal(ToastChrome.muteLabel(), "Never on this site");
});
