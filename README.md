# Convert

Convert turns a file you already have into another type a program will accept. The interaction is a right-click menu, Convert to, that lists only the types this file can become.

This repository holds the shared conversion core. A browser extension and a Windows app sit on later branches and call the same graph.

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
