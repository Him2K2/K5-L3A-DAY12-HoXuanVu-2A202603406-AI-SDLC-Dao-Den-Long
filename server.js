// Zero-dependency server for the playable build (run_cmd: `node server.js`).
//   node server.js                              serve the game and open the browser
//   node server.js --no-open [--port 8080]       serve only
//   node server.js --export-leaderboard out.json  write {"entries":[...]} (top 10, ranked) and exit
// The leaderboard lives on disk in data/leaderboard.json (survives restarts).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { spawn } from "node:child_process";
import { validateEntry, addEntry, sortEntries, MAX_ENTRIES } from "./src/leaderboard.js";

const root = path.dirname(url.fileURLToPath(import.meta.url));
// DDL_LEADERBOARD lets tests point at a scratch file instead of the player's real board.
const DATA_FILE = process.env.DDL_LEADERBOARD || path.join(root, "data", "leaderboard.json");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};

export function readBoard(file = DATA_FILE) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const list = Array.isArray(data.entries) ? data.entries.filter((e) => validateEntry(e).ok) : [];
    return sortEntries(list).slice(0, MAX_ENTRIES);
  } catch { return []; }
}
function writeBoard(entries, file = DATA_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2));
  fs.renameSync(tmp, file); // atomic replace: a crash never leaves a half-written board
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "content-type": MIME[".json"], "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

export function createServer({ dataFile = DATA_FILE } = {}) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/api/leaderboard") {
      if (req.method === "GET") return sendJson(res, 200, { entries: readBoard(dataFile) });
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => { body += c; if (body.length > 10000) req.destroy(); });
        req.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(body); } catch { return sendJson(res, 400, { error: "invalid JSON" }); }
          const v = validateEntry(parsed);
          if (!v.ok) return sendJson(res, 400, { error: v.error });
          const { entries, rank } = addEntry(readBoard(dataFile), v.entry);
          writeBoard(entries, dataFile);
          sendJson(res, 200, { entries, rank });
        });
        return;
      }
      return sendJson(res, 405, { error: "method not allowed" });
    }
    let p = decodeURIComponent(u.pathname);
    if (p === "/") p = "/web/index.html";
    const abs = path.join(root, path.normalize(p));
    if (!abs.startsWith(root) || abs.startsWith(path.join(root, "data"))) { res.writeHead(403).end("forbidden"); return; }
    fs.readFile(abs, (err, data) => {
      if (err) { res.writeHead(404).end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(abs)] || "application/octet-stream" });
      res.end(data);
    });
  });
}

export function start(port = 8080) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

function openBrowser(target) {
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", target]]
    : process.platform === "darwin" ? ["open", [target]] : ["xdg-open", [target]];
  try { spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).on("error", () => {}).unref(); } catch { /* no browser */ }
}

// ---- CLI ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === url.fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const ex = args.indexOf("--export-leaderboard");
  if (ex >= 0) {
    const out = args[ex + 1];
    if (!out) { process.stderr.write("usage: node server.js --export-leaderboard out.json\n"); process.exit(1); }
    fs.writeFileSync(out, JSON.stringify({ entries: readBoard() }, null, 2) + "\n");
    process.exit(0);
  }
  const pi = args.indexOf("--port");
  const port = pi >= 0 ? Number(args[pi + 1]) : Number(process.env.PORT || 8080);
  start(port).then(({ port: p }) => {
    const link = `http://localhost:${p}`;
    console.log(`\n  Đảo Đèn Lồng is running:  ${link}\n  (Ctrl+C to stop)\n`);
    if (!args.includes("--no-open")) openBrowser(link);
  }).catch((e) => { process.stderr.write(`[error] ${e.message}\n`); process.exit(1); });
}
