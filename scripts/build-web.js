// Build the release package (TICKET-04 §5): a self-contained static web folder + zip.
//   node scripts/build-web.js   ->  dist/dao-den-long-web-v<version>/ and .zip
// Play it with any static server (ES modules need http://, not file://), e.g.
//   node server.js            (inside the folder; also enables the on-disk leaderboard)
//   python3 -m http.server 8080
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const name = `dao-den-long-web-v${pkg.version}`;
const dist = path.join(root, "dist");
const out = path.join(dist, name);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const copy = (rel) => fs.cpSync(path.join(root, rel), path.join(out, rel), { recursive: true });
for (const rel of ["web", "src", "server.js", "game.contract.json", "LICENSE", "CREDITS.md", "CHANGELOG.md"]) copy(rel);
// Static hosts serve /index.html at the root; the page uses absolute /web/... paths, so a copy works as-is.
fs.copyFileSync(path.join(root, "web", "index.html"), path.join(out, "index.html"));
fs.writeFileSync(path.join(out, "package.json"), JSON.stringify({ name: pkg.name, version: pkg.version, type: "module", private: true, scripts: { start: "node server.js" } }, null, 2) + "\n");
fs.writeFileSync(path.join(out, "PLAY.txt"), [
  `Đảo Đèn Lồng v${pkg.version} — bản web tĩnh`,
  "",
  "Cách 1 (khuyên dùng, cần Node >= 18):  node server.js        -> tự mở http://localhost:8080",
  "        Bảng xếp hạng lưu trên đĩa ở data/leaderboard.json",
  "Cách 2 (không cần Node):              python3 -m http.server 8080   rồi mở http://localhost:8080",
  "        Bảng xếp hạng lưu trong trình duyệt (localStorage)",
  "",
  "Không mở index.html trực tiếp bằng file:// — trình duyệt chặn ES module.",
  "Điều khiển: WASD chạy · chuột xoay góc nhìn · Space nhảy · Shift lướt · E thắp/châm dầu · Q tỏa sáng · Esc/P tạm dừng",
].join("\n") + "\n");

// Zip it (PowerShell on Windows, `zip` elsewhere). The folder alone is also a valid release.
const zip = path.join(dist, `${name}.zip`);
try {
  if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command", `Compress-Archive -Path '${out}' -DestinationPath '${zip}' -Force`], { stdio: "ignore" });
  } else {
    execFileSync("zip", ["-qr", zip, name], { cwd: dist, stdio: "ignore" });
  }
  console.log(`built ${path.relative(root, out)}/ and ${path.relative(root, zip)} (${(fs.statSync(zip).size / 2 ** 20).toFixed(1)} MB)`);
} catch {
  console.log(`built ${path.relative(root, out)}/ (zip tool not available — zip the folder manually)`);
}
