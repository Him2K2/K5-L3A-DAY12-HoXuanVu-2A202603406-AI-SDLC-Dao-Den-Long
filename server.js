// Zero-dependency static server for the playable build (run_cmd: `npm start`).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const root = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/web/index.html";
  const abs = path.join(root, path.normalize(p));
  if (!abs.startsWith(root)) { res.writeHead(403).end("forbidden"); return; }
  fs.readFile(abs, (err, data) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(abs)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  Dao Den Long is running:  http://localhost:${PORT}\n  (press Ctrl+C to stop)\n`);
});
