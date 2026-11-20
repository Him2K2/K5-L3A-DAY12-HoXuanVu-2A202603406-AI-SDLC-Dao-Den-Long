#!/usr/bin/env node
// Benchmark runner (TICKET-04 §1, Contract v1.3 bench_cmd).
//   node scripts/bench.js --seed 42 --duration 30 --out bench.json
// Starts the game server, opens a REAL (windowed, not headless) Chrome via Puppeteer with a 1280x720
// viewport and vsync/frame-rate limit disabled, runs /?bench=1 (standard scene), and writes bench.json.
// The page measures every frame's dt; this process measures peak RSS of the whole Chrome process tree.
import fs from "node:fs";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { start } from "../server.js";

const START_EPOCH = Date.now() - process.uptime() * 1000; // "from process start" for load_ms

function args() {
  const a = { seed: 42, duration: 30, out: "bench.json" };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "--seed") a.seed = Number(v[++i]);
    else if (v[i] === "--duration") a.duration = Number(v[++i]);
    else if (v[i] === "--out") a.out = v[++i];
    else throw new Error(`unknown argument ${v[i]}`);
  }
  if (!Number.isInteger(a.seed) || !(a.duration > 0)) throw new Error("--seed must be an integer and --duration > 0");
  return a;
}

// Sum RSS (MB) of `rootPid` and all descendants from rows [pid, ppid, mb].
function treeSum(rows, rootPid) {
  const kids = new Map();
  for (const [p, pp] of rows) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  const rss = new Map(rows.map(([p, , m]) => [p, m]));
  let total = 0;
  const stack = [rootPid], seen = new Set();
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    total += rss.get(p) || 0;
    for (const c of kids.get(p) || []) stack.push(c);
  }
  return total;
}

// Peak-RSS sampler for the Chrome process tree, every 2 s, kept off the critical path:
//  - Windows: ONE long-lived PowerShell at Idle priority (re-spawning PowerShell every second caused
//    visible frame spikes in our own measurements: p1_low 38 fps with sampling vs 86 without);
//  - macOS/Linux: async `ps` (cheap).
class MemSampler {
  constructor(rootPid) {
    this.peak = null;
    this.measuring = false;
    const record = (mb) => { if (this.measuring && Number.isFinite(mb) && mb > 0) this.peak = Math.max(this.peak ?? 0, mb); };
    if (process.platform === "win32") {
      const ps = `$ErrorActionPreference='SilentlyContinue'
[System.Diagnostics.Process]::GetCurrentProcess().PriorityClass='Idle'
$root=${rootPid}
while ($true) {
  $all = Get-CimInstance Win32_Process -Property ProcessId,ParentProcessId,WorkingSetSize
  $kids=@{}; $byId=@{}
  foreach ($p in $all) { $byId[[int]$p.ProcessId]=$p; $k=[int]$p.ParentProcessId; if (-not $kids.ContainsKey($k)) { $kids[$k]=New-Object System.Collections.ArrayList }; [void]$kids[$k].Add([int]$p.ProcessId) }
  $sum=0; $seen=@{}; $stack=New-Object System.Collections.Stack; $stack.Push($root)
  while ($stack.Count) { $id=$stack.Pop(); if ($seen[$id]) { continue }; $seen[$id]=1; if ($byId[$id]) { $sum+=$byId[$id].WorkingSetSize }; foreach ($c in $kids[$id]) { $stack.Push($c) } }
  [Console]::Out.WriteLine([math]::Round($sum/1MB)); [Console]::Out.Flush()
  Start-Sleep -Milliseconds 2000
}`;
      this.proc = spawn("powershell", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(ps, "utf16le").toString("base64")],
        { stdio: ["ignore", "pipe", "ignore"] });
      this.proc.on("error", () => {});
      let buf = "";
      this.proc.stdout.on("data", (d) => {
        buf += d;
        const lines = buf.split(/\r?\n/); buf = lines.pop();
        for (const l of lines) record(Number(l.trim()));
      });
    } else {
      this.timer = setInterval(() => {
        execFile("ps", ["-A", "-o", "pid=,ppid=,rss="], (err, out) => {
          if (err) return;
          const rows = out.trim().split("\n").map((l) => l.trim().split(/\s+/).map(Number)).map(([p, pp, kb]) => [p, pp, kb / 1024]);
          record(treeSum(rows, rootPid));
        });
      }, 2000);
    }
  }
  stop() { if (this.proc) this.proc.kill(); if (this.timer) clearInterval(this.timer); }
}

async function main() {
  const a = args();
  let puppeteer;
  try { puppeteer = (await import("puppeteer")).default; } catch {
    throw new Error("puppeteer is not installed — run `npm install` (it is an optional dependency that downloads Chrome).");
  }
  const { server, port } = await start(0);
  const browser = await puppeteer.launch({
    headless: false, // a real window, as the ticket requires
    defaultViewport: { width: 1280, height: 720 },
    args: [
      "--window-size=1296,860",
      "--disable-gpu-vsync", "--disable-frame-rate-limit", // vsync off
      "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
      "--no-first-run", "--no-default-browser-check",
    ],
  });
  const chromePid = browser.process()?.pid;
  const sampler = chromePid && !process.env.BENCH_NO_MEM ? new MemSampler(chromePid) : null;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Diagnostics: anything that would kill or reload the measured page.
    page.on("crash", () => process.stderr.write("[bench] page crashed\n"));
    page.on("close", () => process.stderr.write("[bench] page closed\n"));
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) process.stderr.write(`[bench] navigated: ${f.url()}\n`); });
    page.on("console", (m) => { if (m.type() === "error") process.stderr.write(`[bench] console error: ${m.text()}\n`); });
    browser.on("disconnected", () => process.stderr.write("[bench] browser disconnected\n"));
    await page.goto(`http://127.0.0.1:${port}/?bench=1&seed=${a.seed}&duration=${a.duration}`, { waitUntil: "load" });
    const deadline = Date.now() + (a.duration + 120) * 1000;
    for (;;) {
      const phase = await page.evaluate(() => (window.__bench ? window.__bench.phase : "loading"));
      if (phase === "done") break;
      if (errors.length) throw new Error(`page error: ${errors[0]}`);
      if (Date.now() > deadline) throw new Error(`benchmark timed out in phase "${phase}"`);
      if (sampler) sampler.measuring = phase === "measure";
      await new Promise((r) => setTimeout(r, 250));
    }
    const B = await page.evaluate(() => window.__bench);
    const cpu = os.cpus()[0]?.model?.trim() || "unknown CPU";
    const result = {
      contract_version: "1.3",
      avg_fps: B.avg_fps,
      p1_low_fps: B.p1_low_fps,
      frame_ms_p95: B.frame_ms_p95,
      frames: B.frames,
      load_ms: Math.round(B.firstFrameEpoch - START_EPOCH),
      peak_mem_mb: sampler && sampler.peak != null ? Math.round(sampler.peak) : null,
      vsync_off: true,
      renderer: `${B.renderer} (Puppeteer ${await browser.version()}, windowed 1280x720, --disable-gpu-vsync --disable-frame-rate-limit)`,
      os: `${os.type()} ${os.release()} ${os.arch()} · ${cpu} · ${Math.round(os.totalmem() / 2 ** 30)} GB RAM`,
      scene: { seed: B.seed, duration_s: B.duration, shades: B.shades, motes: B.motes, warmup_s: 3 },
      peak_mem_note: "RSS summed over the Chrome process tree (browser + GPU + renderer), sampled every 2 s while measuring by a low-priority sampler.",
      slow_frames_over_25ms: (B.spikes || []).slice(0, 50), // diagnostics: [seconds since start, dt ms]
    };
    fs.writeFileSync(a.out, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (sampler) sampler.stop();
    await browser.close();
    server.close();
  }
}

main().then(() => process.exit(0)).catch((e) => {
  process.stderr.write(`[bench error] ${e.message}\n`);
  process.exit(1);
});
