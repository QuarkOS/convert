# Convert for Windows, Microsoft Store listing draft

This is a draft for the Microsoft Store. It is not submitted.

## Name

Convert

## Summary

Convert a file to another type from File Explorer. The conversion runs on this PC.

## Description

Right-click a file and choose Convert to. The submenu lists only the types that file can become. Pick one and Convert writes the new file beside the original.

You can also open Convert with several files. The window lists those names and the types they can all become. One click writes one new file per selection.

Nothing is uploaded. HEIC can be read when the file is a photo, and it is not offered as a target. SVG is a source only.

On Windows 11 the Convert to cascade is a classic Explorer menu. It appears when you choose Show more options. This package does not include a COM shell extension for the compact menu.

## Package

Identity `Quack.Convert`, version `0.1.0.0`, publisher `CN=Convert`, architecture x64. The app asks for `runFullTrust` so it can write the converted file next to the one you selected and register the Explorer menu for your user.

The manifest is `apps/windows/AppxManifest.xml`. Convert is not submitted from this repository, and the package does not call Partner Center.

## Data

Files are read and written on this PC. Convert does not run a server and does not add an analytics endpoint.

## Engines in this package

The Windows host uses the bundled Node engines. Pandoc is not included.

- `sharp` 0.34.4, Apache-2.0, bundles libvips (LGPL-2.1 or later) in the Node addon.
- `heic-decode` 2.1.0, ISC, loads libheif (LGPL-3.0) to decode HEIC. It does not encode HEIC.
- `pdf-lib` 1.17.1, MIT, writes PDF.
- `pdfjs-dist` 4.8.69, Apache-2.0, reads PDF text.
- `exceljs` 4.4.0, MIT, reads and writes XLSX.
- `jszip` 3.10.1, used under MIT, for DOCX, ODT, and ODS.
- `yaml` 2.6.1, ISC.
- `fast-xml-parser` 4.5.1, MIT.
- `smol-toml` 1.3.1, BSD-3-Clause.
- `ffmpeg`, when it is already on PATH, for audio and video. It is not vendored.

Notices for libvips and libheif ship with those Node addons.
