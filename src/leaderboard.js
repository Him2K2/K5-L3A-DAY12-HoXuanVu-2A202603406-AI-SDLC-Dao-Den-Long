// Local leaderboard rules (TICKET-04 §3). Pure functions: used by the Node server (disk storage),
// by the browser (localStorage fallback for the static release) and by the self-tests.

export const MAX_ENTRIES = 10;

// 3–12 characters: letters (incl. Vietnamese with diacritics — the optional bonus), digits, underscore.
const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;
const ISO_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function normalizeName(name) {
  return typeof name === "string" ? name.normalize("NFC").trim() : "";
}

export function validateName(name) {
  const n = normalizeName(name);
  if (!NAME_RE.test(n)) return { ok: false, error: "Tên 3–12 ký tự: chữ, số hoặc _ (có thể có dấu tiếng Việt)." };
  return { ok: true, name: n };
}

// ISO 8601 with the local UTC offset, e.g. 2026-11-20T16:40:05+07:00.
export function isoWithOffset(d = new Date()) {
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

export function validateEntry(e) {
  if (!e || typeof e !== "object") return { ok: false, error: "entry must be an object" };
  const n = validateName(e.name);
  if (!n.ok) return n;
  if (!Number.isInteger(e.score) || e.score < 0) return { ok: false, error: "score must be a non-negative integer" };
  if (!Number.isInteger(e.nights_won) || e.nights_won < 0 || e.nights_won > 3) return { ok: false, error: "nights_won must be 0–3" };
  if (typeof e.achieved_at !== "string" || !ISO_TZ_RE.test(e.achieved_at) || Number.isNaN(Date.parse(e.achieved_at))) {
    return { ok: false, error: "achieved_at must be ISO 8601 with a time zone" };
  }
  if (!Number.isInteger(e.seed)) return { ok: false, error: "seed must be an integer" };
  return { ok: true, entry: { name: n.name, score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed } };
}

// Score descending; on a tie, whoever achieved it first ranks higher (stable for identical times).
export function sortEntries(entries) {
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.score - a.e.score) || (Date.parse(a.e.achieved_at) - Date.parse(b.e.achieved_at)) || (a.i - b.i))
    .map((x) => x.e);
}

// Insert, re-sort and keep the top 10. Returns { entries, rank } (rank is 1-based, or null if it fell off).
export function addEntry(entries, entry) {
  const all = sortEntries([...entries, entry]);
  const kept = all.slice(0, MAX_ENTRIES);
  const idx = kept.indexOf(entry);
  return { entries: kept, rank: idx >= 0 ? idx + 1 : null };
}
