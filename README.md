# Convert

Convert turns a file you already have into another type a program will accept. The interaction is a right-click menu, Convert to, that lists only the types this file can become.

This repository holds the shared conversion core and a Manifest V3 browser extension. The Windows app sits on a later branch and calls the same graph.

## Run the tests

You need Node.js 22 or newer, plus `ffmpeg`, `ffprobe`, `pandoc`, and `pdftotext` on your `PATH`. Those programs are how the host engines prove a file is real. The bundled engine set, the one the Windows package will ship, does not call pandoc.

```bash
npm install
npm test
```

`npm run typecheck` runs the TypeScript checker. `npm run matrix` prints, for each input type, the targets the host engines can reach.

Fixture files live under `packages/core/fixtures`. `npm run fixtures -w @convert/core` rebuilds them with ffmpeg, pandoc, and small writers. One HEIC fixture is a decode sample. This machine has no HEVC encoder, so the graph does not offer HEIC as a target.

## Layout

`packages/core` is the library. `FormatGraph` is the list of legal conversions. `ConversionJob` walks a path, including a chain when no engine converts the pair in one step. Node hosts load engines from `@convert/core/node`.

## Browser extension

`packages/extension` is a Manifest V3 popup and content script. It converts on the device. Image targets use the browser canvas. Documents, PDF, spreadsheets, and data use the same pure-JavaScript engines as the core. Audio, video, HEIC, and ffmpeg are not in the extension graph.

```bash
npm run build -w @convert/extension
```

Load `packages/extension/dist` as an unpacked extension in Chrome. Fixture pages, one with an `accept` list and one that rejects in script, are served with:

```bash
npm run serve -w @convert/extension
```

That listens on `http://127.0.0.1:43127/accept.html`. The store listing draft is `docs/store-listings/extension.md`. It is a draft. Nothing here is published to a browser store.
