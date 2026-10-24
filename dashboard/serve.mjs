// Serves the static export in out/ for local production use. `next start`
// cannot serve `output: "export"` builds, and this avoids extra dependencies.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT) || 4001;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function fileSize(candidate) {
  try {
    const info = await stat(candidate);
    return info.isFile() ? info.size : null;
  } catch {
    return null;
  }
}

// Maps clean URLs (/analytics) to the exported page files (analytics.html).
async function resolveFile(pathname) {
  const target = path.normalize(path.join(root, pathname));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  for (const candidate of [target, `${target}.html`, path.join(target, "index.html")]) {
    const size = await fileSize(candidate);
    if (size !== null) return { filePath: candidate, size };
  }
  return null;
}

function sendFile(req, res, { filePath, size }, status = 200) {
  const extension = path.extname(filePath).toLowerCase();
  const immutable = filePath.startsWith(path.join(root, "_next", "static") + path.sep);
  res.writeHead(status, {
    "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
    "Content-Length": size,
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).on("error", () => res.destroy()).pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  // Pages use assetPrefix "./", so a trailing slash would break asset URLs.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    res.writeHead(308, { Location: pathname.replace(/\/+$/, "") + query }).end();
    return;
  }

  const file = await resolveFile(pathname);
  if (file) {
    sendFile(req, res, file);
    return;
  }

  const notFound = path.join(root, "404.html");
  const notFoundSize = await fileSize(notFound);
  if (notFoundSize !== null) {
    sendFile(req, res, { filePath: notFound, size: notFoundSize }, 404);
  } else {
    res.writeHead(404).end();
  }
});

server.listen(port, host, () => {
  console.log(`Samaritan dashboard serving ${root} on http://${host}:${port}`);
});
