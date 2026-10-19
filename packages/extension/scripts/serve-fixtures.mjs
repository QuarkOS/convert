import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pages = resolve(root, "fixtures/pages");
const images = resolve(root, "../core/fixtures/images");
const port = Number(process.env.PORT ?? 43127);
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const image = url.pathname.startsWith("/images/");
  const base = image ? images : pages;
  const name = image ? url.pathname.slice("/images/".length) : url.pathname === "/" ? "accept.html" : url.pathname.slice(1);
  const file = normalize(join(base, name));
  if (!file.startsWith(base)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types.get(extname(file)) ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fixtures http://127.0.0.1:${port}/accept.html`);
});
