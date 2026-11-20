#!/usr/bin/env node
// Soak test (TICKET-04 §2, Contract v1.3 soak_cmd).
//   node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json
// Runs N nights back to back in ONE process (night 1 -> 2 -> 3 -> 1 ...), night i (0-based) with seed
// `seed + i`, each until it ends or reaches its standard length. Random inputs from a seeded PRNG:
// every 30 ticks a new move direction; each tick 5% jump, 3% dash, 2% pulse, 10% interact.
import fs from "node:fs";
import { Game } from "../src/core/game.js";
import { makeRNG } from "../src/core/prng.js";
import { TICK_HZ } from "../src/core/config.js";

const rssMb = () => Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
const heapMb = () => Math.round((process.memoryUsage().heapUsed / 2 ** 20) * 100) / 100;
// Why soak_cmd passes --no-opt: without it RSS gains ~9 MB once, during the first night, from V8's
// TurboFan optimised code + compiler zones (measured: ratio 1.26 default, 1.09 --no-opt, same run time);
// heapUsed (live JS objects) stays flat across 30 nights either way. heap_used_* below shows that a real
// leak — game objects kept alive between nights — would still be caught.
const gc = () => { if (typeof global.gc === "function") { global.gc(); global.gc(); } };

function args() {
  const a = { seed: 7, nights: 10, out: "soak.json" };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "--seed") a.seed = Number(v[++i]);
    else if (v[i] === "--nights") a.nights = Number(v[++i]);
    else if (v[i] === "--out") a.out = v[++i];
    else throw new Error(`unknown argument ${v[i]}`);
  }
  if (!Number.isInteger(a.seed) || !Number.isInteger(a.nights) || a.nights < 1) throw new Error("--seed and --nights must be integers (nights >= 1)");
  return a;
}

// The seeded random input stream for one night (decorrelated from the game's own PRNG).
export function makeSoakInput(seed) {
  const rng = makeRNG(Math.imul(seed ^ 0x5eed, 2654435761) >>> 0);
  const inp = { move: [0, 0], camYaw: 0, pause: false, jump: false, dash: false, pulse: false, interact: false };
  return (tick) => { // one reused object: no garbage per tick
    if (tick % 30 === 0) { const a = rng.next() * Math.PI * 2; inp.move[0] = Math.cos(a); inp.move[1] = Math.sin(a); }
    inp.jump = rng.next() < 0.05;
    inp.dash = rng.next() < 0.03;
    inp.pulse = rng.next() < 0.02;
    inp.interact = rng.next() < 0.10;
    return inp;
  };
}

export function runNight(night, seed) {
  let game = new Game({ seed, night });
  const input = makeSoakInput(seed);
  const maxTicks = Math.round(game.timeLeft * TICK_HZ) + 1; // standard night length (+1 for the dawn tick)
  let t = 0;
  while (game.state === "playing" && t < maxTicks) game.step(input(t++));
  const res = { night, seed, result: game.state === "won" ? "won" : "lost", reason: null, score: game.score, ticks: t, lit_at_end: game.litCount() };
  res.reason = game.state === "playing" ? "time_cap" : (game.player.flames <= 0 ? "no_flames" : game.state === "won" ? "dawn_survived" : "dawn");
  game = null; // reset: drop every reference to the night
  return { res, gameRef: game };
}

function main() {
  const a = args();
  const t0 = process.hrtime.bigint();
  const results = [], details = [];
  let crashes = 0, memStart = null, heapStart = null;
  for (let i = 0; i < a.nights; i++) {
    const night = (i % 3) + 1, seed = a.seed + i;
    try {
      if (i === 0) {
        // mem_start: RSS right after the first night has been loaded.
        const probe = new Game({ seed, night });
        gc(); memStart = rssMb(); heapStart = heapMb();
        void probe;
      }
      const { res } = runNight(night, seed);
      results.push(res.result);
      details.push(res);
    } catch (e) {
      crashes++;
      results.push("crash");
      details.push({ night, seed, error: String(e && e.stack || e) });
      process.stderr.write(`[soak] night ${i} crashed: ${e && e.message}\n`);
    }
  }
  gc(); // mem_end: RSS after the last night has been reset
  const memEnd = rssMb();
  const out = {
    nights: a.nights, crashes, results,
    mem_start_mb: memStart, mem_end_mb: memEnd,
    duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10,
    mem_ratio: memStart ? Math.round((memEnd / memStart) * 1000) / 1000 : null,
    pass: crashes === 0 && memStart != null && memEnd <= 1.2 * memStart,
    heap_used_start_mb: heapStart, heap_used_end_mb: heapMb(),
    seed: a.seed, node: process.version, gc_exposed: typeof global.gc === "function",
    v8_flags: process.execArgv.join(" "),
    details,
  };
  fs.writeFileSync(a.out, JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify({ ...out, details: undefined }, null, 2));
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  try { main(); process.exit(0); } catch (e) { process.stderr.write(`[soak error] ${e.message}\n`); process.exit(1); }
}
