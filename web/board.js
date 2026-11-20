// Leaderboard client (TICKET-04 §3). Primary storage: the Node server's data/leaderboard.json via
// /api/leaderboard (on disk, exportable with `node server.js --export-leaderboard`). When the game is
// served as a plain static folder (no API), it falls back to localStorage with the same rules.
import { addEntry, sortEntries, validateEntry, MAX_ENTRIES } from "../src/leaderboard.js";

const LOCAL_KEY = "ddl.leaderboard.v1";
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; } };
const writeLocal = (e) => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(e)); } catch { /* ignore */ } };

export async function loadBoard() {
  try {
    const r = await fetch("/api/leaderboard", { cache: "no-store" });
    if (r.ok) return { entries: (await r.json()).entries, where: "disk" };
  } catch { /* static hosting */ }
  return { entries: sortEntries(readLocal()).slice(0, MAX_ENTRIES), where: "browser" };
}

export async function saveScore(entry) {
  const v = validateEntry(entry);
  if (!v.ok) return { ok: false, error: v.error };
  try {
    const r = await fetch("/api/leaderboard", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v.entry) });
    if (r.ok) { const j = await r.json(); return { ok: true, rank: j.rank, entries: j.entries, where: "disk" }; }
    if (r.status === 400) return { ok: false, error: (await r.json()).error };
  } catch { /* static hosting */ }
  const res = addEntry(readLocal(), v.entry);
  writeLocal(res.entries);
  return { ok: true, rank: res.rank, entries: res.entries, where: "browser" };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function renderBoard(el, entries, highlightRank = null) {
  if (!entries.length) { el.innerHTML = '<p class="muted">Chưa có ai trên bảng. Hãy là người đầu tiên!</p>'; return; }
  el.innerHTML = `<table class="board"><thead><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Ngày</th></tr></thead><tbody>${
    entries.map((e, i) => `<tr class="${highlightRank === i + 1 ? "me" : ""}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 10))}</td></tr>`).join("")
  }</tbody></table>`;
}
