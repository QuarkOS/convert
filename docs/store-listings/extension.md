# Convert, browser extension listing draft

This is a draft for the Chrome Web Store and Firefox Add-ons. It is not submitted.

## Name

Convert

## Summary

Convert a file to a type the page will accept. The conversion runs on this device.

## Description

Right-click an image or a link and choose Convert to. The menu lists only the types that file can become.

Drop a file on the toolbar popup, pick a type, and save the result. Nothing is uploaded.

When a page asks for one kind of file and you choose another, Convert offers a replacement before the page takes it. If the page rejects the file in script, a small note appears next to the input. You can turn that offer off for one site, or turn it off everywhere from the popup.

The extension converts still images with the browser's own canvas (PNG, JPEG, WebP, BMP, ICO, plus GIF, AVIF, and SVG as sources). It converts documents (DOCX, Markdown, HTML, text, ODT, RTF, PDF), spreadsheets (CSV, JSON, ODS), and data files (JSON, YAML, XML, TOML) with the same local engines as the Convert library. HEIC, audio, and video are not offered here.

## Permissions

- `storage`. Remembers the global offer switch and the sites you turned off.
- Host access for `http` and `https`. The content script reads the file you chose or the image you right-clicked so it can convert it locally. The bytes are not sent to a server.

The popup saves a file with a normal download link. Convert does not request the downloads permission.

## Data

Files are read in memory and written back to the page or to a download. Convert does not run a server and does not add an analytics endpoint.

## Engines in this package

- Browser canvas for still images. No third-party image codec.
- `pdf-lib` 1.17.1, MIT, writes PDF.
- `pdfjs-dist` 4.8.69, Apache-2.0, reads PDF text.
- `jszip` 3.10.1, used under MIT, for DOCX, ODT, and ODS.
- `yaml` 2.6.1, ISC.
- `fast-xml-parser` 4.5.1, MIT.
- `smol-toml` 1.3.1, BSD-3-Clause.

Not included: sharp, libvips, ffmpeg, pandoc, and heic-decode. Those stay in the Node host because of LGPL or GPL terms, or because this machine cannot encode HEIC.
