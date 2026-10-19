import { execFileSync } from "node:child_process";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts } from "pdf-lib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "fixtures");
const phrase = "ConvertFixture";

function ffmpeg(args: string[]) {
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
}

function pandoc(args: string[]) {
  execFileSync("pandoc", args, { stdio: "inherit" });
}

async function main() {
  const images = join(fixtures, "images");
  const documents = join(fixtures, "documents");
  const sheets = join(fixtures, "sheets");
  const data = join(fixtures, "data");
  const audio = join(fixtures, "audio");
  const video = join(fixtures, "video");
  for (const dir of [images, documents, sheets, data, audio, video]) {
    await mkdir(dir, { recursive: true });
  }

  const png = join(images, "red.png");
  ffmpeg(["-f", "lavfi", "-i", "color=c=0xc81428:s=32x32", "-frames:v", "1", png]);
  ffmpeg(["-i", png, join(images, "red.jpg")]);
  ffmpeg(["-i", png, join(images, "red.webp")]);
  ffmpeg(["-i", png, join(images, "red.avif")]);
  ffmpeg(["-i", png, join(images, "red.gif")]);
  ffmpeg(["-i", png, join(images, "red.bmp")]);
  ffmpeg(["-i", png, join(images, "red.ico")]);
  await writeFile(
    join(images, "red.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#c81428"/></svg>\n`,
  );
  await copyFile("/tmp/sample.heic", join(images, "sample.heic"));

  const md = join(documents, "note.md");
  await writeFile(md, `${phrase}\n`);
  await writeFile(join(documents, "note.txt"), `${phrase}\n`);
  pandoc([md, "-t", "html", "-o", join(documents, "note.html")]);
  pandoc([md, "-t", "docx", "-o", join(documents, "note.docx")]);
  pandoc([md, "-t", "odt", "-o", join(documents, "note.odt")]);
  pandoc([md, "-t", "rtf", "-o", join(documents, "note.rtf")]);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText(phrase, { x: 72, y: 720, size: 18, font });
  await writeFile(join(documents, "note.pdf"), await pdf.save());

  const csv = `name,note\n${phrase},ok\n`;
  await writeFile(join(sheets, "rows.csv"), csv);
  const rows = [{ name: phrase, note: "ok" }];
  await writeFile(join(sheets, "rows.json"), `${JSON.stringify(rows, null, 2)}\n`);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow(["name", "note"]);
  sheet.addRow([phrase, "ok"]);
  await writeFile(join(sheets, "rows.xlsx"), Buffer.from(await workbook.xlsx.writeBuffer()));

  const ods = new JSZip();
  ods.file("mimetype", "application/vnd.oasis.opendocument.spreadsheet", { compression: "STORE" });
  ods.file(
    "content.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet><table:table table:name="Sheet1"><table:table-row><table:table-cell office:value-type="string"><text:p>name</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>note</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell office:value-type="string"><text:p>${phrase}</text:p></table:table-cell><table:table-cell office:value-type="string"><text:p>ok</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet></office:body></office:document-content>`,
  );
  ods.file(
    "META-INF/manifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`,
  );
  await writeFile(join(sheets, "rows.ods"), await ods.generateAsync({ type: "nodebuffer" }));

  const object = { title: phrase, count: 2 };
  await writeFile(join(data, "object.json"), `${JSON.stringify(object, null, 2)}\n`);
  await writeFile(join(data, "object.yaml"), `title: ${phrase}\ncount: 2\n`);
  await writeFile(
    join(data, "object.xml"),
    `<data><title>${phrase}</title><count>2</count></data>\n`,
  );
  await writeFile(join(data, "object.toml"), `title = "${phrase}"\ncount = 2\n`);

  const wav = join(audio, "tone.wav");
  ffmpeg(["-f", "lavfi", "-i", "sine=frequency=440:duration=0.35", wav]);
  ffmpeg(["-i", wav, "-c:a", "libmp3lame", join(audio, "tone.mp3")]);
  ffmpeg(["-i", wav, "-c:a", "flac", join(audio, "tone.flac")]);
  ffmpeg(["-i", wav, "-c:a", "libvorbis", join(audio, "tone.ogg")]);
  ffmpeg(["-i", wav, "-c:a", "aac", join(audio, "tone.m4a")]);

  const mp4 = join(video, "clip.mp4");
  ffmpeg(["-f", "lavfi", "-i", "color=c=0xc81428:s=64x64:d=0.4", "-c:v", "libx264", "-pix_fmt", "yuv420p", mp4]);
  ffmpeg(["-i", mp4, "-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0", join(video, "clip.webm")]);
  ffmpeg(["-i", mp4, "-c:v", "libx264", "-pix_fmt", "yuv420p", join(video, "clip.mov")]);
  ffmpeg(["-i", mp4, join(video, "clip.gif")]);
}

await main();
