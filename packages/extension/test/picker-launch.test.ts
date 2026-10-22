import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PickerLaunch, type PickerApi, type PickerWindowOptions } from "../src/picker-launch.ts";

const src = join(dirname(fileURLToPath(import.meta.url)), "../src");

class FakeApi {
  static make(withWindows: boolean, windowFails = false) {
    const calls = { windows: [] as PickerWindowOptions[], tabs: [] as { url: string; active: boolean }[], closed: 0 };
    const api: PickerApi = {
      getURL: (path) => `chrome-extension://abc/${path}`,
      createWindow: withWindows
        ? async (options) => {
            calls.windows.push(options);
            if (windowFails) throw new Error("no windows here");
          }
        : undefined,
      createTab: async (options) => {
        calls.tabs.push(options);
      },
      close: () => {
        calls.closed += 1;
      },
    };
    return { api, calls };
  }
}

test("the toolbar popup and the picker page are told apart by the query", () => {
  assert.equal(PickerLaunch.surface(""), "popup");
  assert.equal(PickerLaunch.surface("?other=1"), "popup");
  assert.equal(PickerLaunch.surface("?picker=1"), "page");
  assert.equal(PickerLaunch.path(), "popup.html?picker=1");
  assert.equal(PickerLaunch.surface(new URL(`chrome-extension://abc/${PickerLaunch.path()}`).search), "page");
});

test("choosing a file opens the picker page in a small popup window, then closes the popup", async () => {
  const { api, calls } = FakeApi.make(true);
  assert.equal(await PickerLaunch.open(api), "window");
  assert.deepEqual(calls.windows, [
    { url: "chrome-extension://abc/popup.html?picker=1", type: "popup", width: 420, height: 560, focused: true },
  ]);
  assert.deepEqual(calls.tabs, []);
  assert.equal(calls.closed, 1);
});

test("without a windows API the picker page opens in a tab", async () => {
  const { api, calls } = FakeApi.make(false);
  assert.equal(await PickerLaunch.open(api), "tab");
  assert.deepEqual(calls.tabs, [{ url: "chrome-extension://abc/popup.html?picker=1", active: true }]);
  assert.equal(calls.closed, 1);
});

test("a failed window falls back to a tab", async () => {
  const { api, calls } = FakeApi.make(true, true);
  assert.equal(await PickerLaunch.open(api), "tab");
  assert.equal(calls.windows.length, 1);
  assert.equal(calls.tabs.length, 1);
  assert.equal(calls.closed, 1);
});

test("the popup routes choose-file clicks to the picker page and keeps drop in place", () => {
  const popup = readFileSync(join(src, "popup.ts"), "utf8");
  assert.match(popup, /PickerLaunch\.surface\(location\.search\)/);
  assert.match(popup, /event\.preventDefault\(\);\s*\n(.*\n)*?\s*void PickerLaunch\.open\(PickerLaunch\.browserApi\(\)\)/);
  assert.match(popup, /addEventListener\("drop"/);
  assert.match(popup, /picker\.addEventListener\("change"/);
});
