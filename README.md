# Convert

Convert turns a file you already have into another type a program will accept. The interaction is a right-click menu, Convert to, that lists only the types this file can become.

This repository holds the shared conversion core and the Windows app. Both call the same graph. The browser extension lives on its own branch.

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

On a Windows 11 PC, pack and sideload with the NuGet build tools. The script downloads `Microsoft.Windows.SDK.BuildTools` `10.0.28000.2705`, runs `makeappx.exe` and `signtool.exe` from that package, and does not install the full Windows SDK. `-Sign` creates a throwaway `CN=Convert` certificate in the user temp directory, signs the package, installs it for the current user, and prints `Get-AppxPackage Quack.Convert`. The certificate, the private key, and the signed `.msix` stay out of git.

```powershell
powershell -ExecutionPolicy Bypass -File apps/windows/pack-msix.ps1 -Sign
```
