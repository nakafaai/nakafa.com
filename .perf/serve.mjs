// Serves a built client directory over HTTP/2 the way Workers Static Assets serves a release:
// Brotli for text, immutable cache for hashed assets, HTML by path (`/a/b` -> `a/b/index.html` or `a/b.html`).
// Measurement only. Usage: node serve.mjs <dist/client dir> <port> <cert dir>
import { existsSync, readFileSync, statSync } from "node:fs";
import { createSecureServer } from "node:http2";
import { extname, join, normalize } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const [root = ".", portText = "4300", certs = "."] = process.argv.slice(2);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};
const compressible = new Set([".html", ".js", ".css", ".json", ".svg", ".md", ".txt", ".xml"]);
const cache = new Map();

function resolve(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^\/+/, "").replace(/\/$/, "");
  for (const candidate of [clean, `${clean}/index.html`, `${clean}.html`]) {
    const file = join(root, candidate);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

const server = createSecureServer({
  allowHTTP1: true,
  cert: readFileSync(join(certs, "cert.pem")),
  key: readFileSync(join(certs, "key.pem")),
});
server.on("request", (request, response) => {
  const url = new URL(request.url, "https://localhost");
  const found = resolve(url.pathname);
  const file = found ?? join(root, "404.html");
  if (!existsSync(file)) {
    response.writeHead(404);
    response.end("not found");
    return;
  }
  const ext = extname(file);
  const headers = {
    "content-type": types[ext] ?? "application/octet-stream",
    "cache-control": url.pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate",
  };
  const accepts = String(request.headers["accept-encoding"] ?? "");
  let body = readFileSync(file);
  if (compressible.has(ext) && accepts.includes("br")) {
    body = cache.get(file) ?? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9 } });
    cache.set(file, body);
    headers["content-encoding"] = "br";
  }
  response.writeHead(found ? 200 : 404, headers);
  response.end(body);
});
server.listen(Number(portText), "127.0.0.1", () => console.log(`serving ${root} on https://localhost:${portText}`));
