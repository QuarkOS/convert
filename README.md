# Convert

Convert turns a file you already have into another type a program will accept. The interaction is a right-click menu, Convert to, that lists only the types this file can become.

This repository holds the shared conversion core, a Manifest V3 browser extension, and the Windows app. All three call the same graph.

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

## Windows

`apps/windows` is the desktop host. It uses `NodeEngines.bundled()`, so pandoc is not required. File Explorer gets a per-user cascade named Convert to. Each item is a target the graph allows for that extension, including aliases such as `.jpeg`.

On Windows, with Node.js 22 on `PATH`:

```powershell
powershell -ExecutionPolicy Bypass -File apps/windows/register-menu.ps1
node --experimental-strip-types apps/windows/src/host.ts --to jpg C:\path\photo.png
powershell -ExecutionPolicy Bypass -File apps/windows/window.ps1 C:\path\a.png C:\path\b.png
```

The first command writes `HKCU\Software\Classes\SystemFileAssociations` verbs. On Windows 11 those verbs show in the classic menu, under Show more options. The window converts every file you pass to one shared target, and it says "No file is selected." when the path list is empty.

`apps/windows/AppxManifest.xml` is the Store identity (`Quack.Convert`, `0.1.0.0`). The listing draft is `docs/store-listings/windows.md`. This repo does not submit the package.

On a Windows 11 PC, pack and sideload with the NuGet build tools. The script downloads `Microsoft.Windows.SDK.BuildTools` `10.0.28000.2705`, runs `makeappx.exe` and `signtool.exe` from that package, and does not install the full Windows SDK. `-Sign` builds a throwaway `CN=Convert` code-signing pfx with BouncyCastle (`MemoryCert`). The private key is marked for signature use and the certificate bag is stored ahead of the key bag, which is the shape `signtool /f` will import. `signtool` still has to write that key into the user key store, so a session with no profile cannot finish the signature. The pfx stays in the user temp directory long enough to sign, the public certificate is imported into Trusted People, and the script deletes the pfx before it exits. The certificate, the private key, and the signed `.msix` stay out of git.

```powershell
powershell -ExecutionPolicy Bypass -File apps/windows/pack-msix.ps1 -Sign
```

The Quark command for a Windows session that is already logged on is:

```powershell
powershell -ExecutionPolicy Bypass -File apps/windows/prove-ship.ps1
```

That registers the Explorer Convert to cascade, captures the classic menu into `proof-out/explorer.png`, then runs `pack-msix.ps1 -Sign` as the same user. The log is `proof-out/ship.log`. It records the screenshot path and `Get-AppxPackage Quack.Convert`. A session that is not interactive stops before any of that.
