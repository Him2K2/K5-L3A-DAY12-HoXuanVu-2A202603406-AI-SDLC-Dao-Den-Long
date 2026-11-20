// Regenerate evidence/<PHASE>/ (default phase3) from scratch through the real headless CLI.
// Run: node scripts/gen-evidence.js   (exit 0 = every case met its expectation)
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const RUN = path.join(root, "src/headless/run.js");
const PHASE = process.env.PHASE || "phase3";
const ev = path.join(root, "evidence", PHASE);
const work = path.join(ev, "cases");
fs.rmSync(ev, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const { cases } = JSON.parse(fs.readFileSync(path.join(root, "tests/headless-cases.json"), "utf8"));
const get = (obj, p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const rows = [];
let failed = 0;

for (const c of cases) {
  const args = ["--seed", "1", "--night", String(c.night), "--ticks", String(c.ticks), "--snapshot-every", "1"];
  if (c.scenario) { const f = path.join(work, `${c.name}.scenario.json`); fs.writeFileSync(f, JSON.stringify(c.scenario, null, 2)); args.push("--scenario", f); }
  if (c.inputs) { const f = path.join(work, `${c.name}.inputs.json`); fs.writeFileSync(f, JSON.stringify(c.inputs, null, 2)); args.push("--inputs", f); }
  const out = path.join(ev, `${c.name}.jsonl`);
  execFileSync("node", [RUN, ...args, "--out", out]);
  const lines = fs.readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const names = new Set(lines.filter((l) => l.type === "event").map((l) => l.name));
  const last = lines.filter((l) => l.type === "snapshot").at(-1);
  const end = lines.at(-1);
  const problems = [];
  for (const n of c.expect.events || []) if (!names.has(n)) problems.push(`missing event ${n}`);
  for (const n of c.expect.no_events || []) if (names.has(n)) problems.push(`unexpected event ${n}`);
  for (const [p, want] of Object.entries(c.expect.final || {})) {
    const got = get(last, p);
    const ok = typeof want === "number" ? Math.abs(got - want) <= 2e-3 : got === want;
    if (!ok) problems.push(`${p}=${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
  if (c.expect.end_state && end.state !== c.expect.end_state) problems.push(`end.state=${end.state}`);
  if (problems.length) failed++;
  rows.push(`| ${c.ac} | \`${c.name}\` | N${c.night} | ${problems.length ? "❌ " + problems.join("; ") : "✅"} | ${[...names].join(", ") || "—"} |`);
}

// Determinism: two runs per night must be byte-identical.
const det = [];
for (const n of [1, 2, 3]) {
  const a = path.join(work, `det-${n}-a.jsonl`), b = path.join(work, `det-${n}-b.jsonl`);
  for (const f of [a, b]) execFileSync("node", [RUN, "--seed", "42", "--night", String(n), "--ticks", "6000", "--snapshot-every", "50", "--out", f]);
  const same = fs.readFileSync(a, "utf8") === fs.readFileSync(b, "utf8");
  if (!same) failed++;
  det.push(`| Đêm ${n} | 6000 tick, seed 42 | ${same ? "✅ byte-identical" : "❌ khác nhau"} |`);
  fs.rmSync(b);
}

// Performance: a full night at the contract's maximum length.
const perf = [];
for (const n of [1, 2, 3]) {
  const t0 = process.hrtime.bigint();
  execFileSync("node", [RUN, "--seed", "9", "--night", String(n), "--ticks", "21600", "--snapshot-every", "10", "--out", path.join(work, `perf-${n}.jsonl`)]);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (ms > 30000) failed++;
  perf.push(`| Đêm ${n} | 21 600 tick | ${ms.toFixed(0)} ms | ${ms <= 30000 ? "✅" : "❌"} |`);
  fs.rmSync(path.join(work, `perf-${n}.jsonl`));
}

const md = `# Evidence ${PHASE} (Contract v${JSON.parse(fs.readFileSync(path.join(root, "game.contract.json"), "utf8")).contract_version})

Sinh tự động bằng \`node scripts/gen-evidence.js\` qua CLI headless thật (\`src/headless/run.js\`).
Mỗi case: scenario + inputs nằm trong \`tests/headless-cases.json\`; bản sao file đã chạy ở \`cases/\`; output JSONL ở thư mục này.

Node ${process.version} · ${process.platform}

## Scenario theo tính năng

| AC | Case | Đêm | Kết quả | Sự kiện quan sát được |
|----|------|-----|---------|----------------------|
${rows.join("\n")}

## Tính tất định

| Đêm | Lần chạy | Kết quả |
|-----|----------|---------|
${det.join("\n")}

## Hiệu năng headless (yêu cầu ≤ 30 s)

| Đêm | Độ dài | Thời gian | |
|-----|--------|-----------|--|
${perf.join("\n")}

Bộ test chi tiết (mỗi AC một test + regression các phase trước): xem \`selftest.txt\`.
`;
fs.writeFileSync(path.join(ev, "SUMMARY.md"), md);
console.log(md);
process.exit(failed ? 1 : 0);
