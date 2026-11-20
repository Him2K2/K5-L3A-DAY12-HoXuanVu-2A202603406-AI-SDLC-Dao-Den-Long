// Self-test harness — one test per acceptance criterion in docs/spec-phase2.md,
// plus Phase-1 regression (R*). Run: npm run selftest   (exit 0 = all pass)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { Game } from "../src/core/game.js";
import { InputTrack } from "../src/core/inputs.js";
import { snapshotLine } from "../src/core/snapshot.js";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const RUN = path.join(root, "src", "headless", "run.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ddl-"));
let pass = 0, fail = 0;
const only = process.argv[2]; // optional filter, e.g. "AC1.8"

function test(name, fn) {
  if (only && !name.startsWith(only)) return;
  try {
    const r = fn();
    if (r === true) { pass++; console.log(`  PASS  ${name}`); }
    else { fail++; console.log(`  FAIL  ${name}  ${r === false ? "" : r}`); }
  } catch (e) { fail++; console.log(`  FAIL  ${name}  threw: ${e.stack}`); }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const RND = 2e-3; // snapshot coordinates are rounded to 3 dp (contract), so derived values carry ~1e-3 error
const show = (o) => JSON.stringify(o);

// Empty stage: nothing spawns unless the test asks for it.
const EMPTY = {
  random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
  motes: [], shades: [], drifters: [], charms: [],
};
const scen = (o = {}) => ({ ...EMPTY, ...o });

function sim({ night = 1, seed = 1, scenario = null, frames = null, ticks = 1 }) {
  const g = new Game({ seed, night, scenario });
  const track = new InputTrack(frames ? { frames } : null);
  const events = [];
  const snaps = [snapshotLine(g)];
  for (let k = 0; k < ticks; k++) {
    for (const e of g.step(track.resolve(k))) events.push({ tick: g.tick, ...e });
    snaps.push(snapshotLine(g));
    if (g.state === "won" || g.state === "lost") break;
  }
  return { g, events, snaps, ev: (n) => events.filter((e) => e.name === n) };
}
function cli(args) {
  try {
    execFileSync("node", [RUN, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    return 0;
  } catch (e) { return e.status; }
}
const shade = (snap, id) => snap.shades.find((s) => s.id === id);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

console.log("— Regression (Phase 1 contract) —");

test("R1 determinism: same seed => identical bytes (all 3 nights)", () => {
  for (const n of [1, 2, 3]) {
    const a = path.join(tmp, `a${n}.jsonl`), b = path.join(tmp, `b${n}.jsonl`);
    cli(["--seed", "7", "--night", String(n), "--ticks", "4000", "--out", a, "--snapshot-every", "25"]);
    cli(["--seed", "7", "--night", String(n), "--ticks", "4000", "--out", b, "--snapshot-every", "25"]);
    if (fs.readFileSync(a, "utf8") !== fs.readFileSync(b, "utf8")) return `night ${n} differs`;
  }
  return true;
});
test("R2 different seed => different output", () => {
  const a = path.join(tmp, "s1.jsonl"), b = path.join(tmp, "s2.jsonl");
  cli(["--seed", "1", "--night", "1", "--ticks", "10", "--out", a]);
  cli(["--seed", "2", "--night", "1", "--ticks", "10", "--out", b]);
  return fs.readFileSync(a, "utf8") !== fs.readFileSync(b, "utf8");
});
test("R3 exit 2 on malformed inputs / scenario; exit 1 on bad --night", () => {
  const bad = path.join(tmp, "bad.json"); fs.writeFileSync(bad, "{ nope");
  const dec = path.join(tmp, "dec.json"); fs.writeFileSync(dec, show({ frames: [{ tick: 5 }, { tick: 3 }] }));
  const arr = path.join(tmp, "arr.json"); fs.writeFileSync(arr, "[1,2]");
  const out = path.join(tmp, "x.jsonl");
  const c = [
    cli(["--seed", "1", "--night", "1", "--inputs", bad, "--ticks", "1", "--out", out]),
    cli(["--seed", "1", "--night", "1", "--inputs", dec, "--ticks", "1", "--out", out]),
    cli(["--seed", "1", "--night", "1", "--scenario", arr, "--ticks", "1", "--out", out]),
    cli(["--seed", "1", "--night", "4", "--ticks", "1", "--out", out]),
  ];
  return show(c) === show([2, 2, 2, 1]) || `codes=${show(c)}`;
});
test("R4 tick model: event from input tick k is logged at tick k+1; end line last", () => {
  const out = path.join(tmp, "r4.jsonl");
  const sc = path.join(tmp, "r4s.json");
  fs.writeFileSync(sc, show(scen({ player: { pos: [0, 0, 23.5], carried: 4 } })));
  const inp = path.join(tmp, "r4i.json");
  fs.writeFileSync(inp, show({ frames: [{ tick: 7, interact: true }] }));
  cli(["--seed", "1", "--night", "1", "--scenario", sc, "--inputs", inp, "--ticks", "12", "--out", out]);
  const L = fs.readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const dep = L.find((l) => l.name === "deposit");
  return (dep.tick === 8 && L.at(-1).type === "end" && L[0].type === "snapshot" && L[0].tick === 0) || show(dep);
});
test("R5 building a scenario emits no gameplay events and scores nothing", () => {
  const r = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }] }), ticks: 0 });
  return (r.snaps[0].score === 0 && r.events.length === 0 && r.snaps[0].lanterns[0].lit) || show(r.snaps[0]);
});

console.log("— A. Standard numbers & tick order —");

test("AC1.1 run 6.0 m/s instantly; camera yaw rotates input", () => {
  const a = sim({ scenario: scen(), frames: [{ tick: 0, move: [0, 1] }], ticks: 60 });
  const b = sim({ scenario: scen(), frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }], ticks: 60 });
  const c = sim({ scenario: scen(), frames: [{ tick: 0, move: [1, 1] }], ticks: 60 }); // normalised
  const pa = a.snaps[60].player.pos, pb = b.snaps[60].player.pos, pc = c.snaps[60].player.pos;
  return (near(pa[2], 6) && near(a.snaps[1].player.pos[2], 0.1) && near(pb[0], 6) && near(pb[2], 0, 1e-3) &&
    near(Math.hypot(pc[0], pc[2]), 6, 1e-3)) || show([pa, pb, pc]);
});
test("AC1.2 jump 7 m/s, g=-20, only when grounded; lands at y=0", () => {
  const r = sim({ scenario: scen(), frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }, { tick: 20, jump: true }], ticks: 60 });
  const ys = r.snaps.map((s) => s.player.pos[1]);
  const peak = Math.max(...ys);
  const landed = r.snaps.findIndex((s, i) => i > 1 && s.player.grounded);
  return (peak > 1.1 && peak <= 1.225 && landed > 35 && landed < 50 && r.snaps[60].player.pos[1] === 0) ||
    show({ peak, landed });
});
test("AC1.3 dash 14 m/s x 12 ticks = 2.8 m; cooldown 90 ticks from start; air dash holds height", () => {
  const a = sim({ scenario: scen(), frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 50, dash: true }, { tick: 51, dash: false }, { tick: 90, dash: true }], ticks: 100 });
  const z12 = a.snaps[12].player.pos[2], z30 = a.snaps[30].player.pos[2];
  const dashTicks = a.ev("dash").map((e) => e.tick);
  const b = sim({ scenario: scen(), frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 89, dash: true }], ticks: 95 });
  const c = sim({ scenario: scen(), frames: [{ tick: 0, jump: true }, { tick: 10, dash: true }], ticks: 30 });
  const ys = c.snaps.slice(11, 23).map((s) => s.player.pos[1]);
  return (near(z12, 2.8) && near(z30, 2.8) && show(dashTicks) === "[1,91]" &&
    b.ev("dash").length === 1 && ys.every((y) => y === ys[0]) && ys[0] > 0) || show({ z12, z30, dashTicks, ys });
});
test("AC1.4 pickup XZ<=1.0 and height gap<=1.5; capacity 10", () => {
  const r = sim({ scenario: scen({ motes: [[0, 0, 1.0], [0, 0, -1.01], [0.5, 2.0, 0]] }), ticks: 1 });
  const cap = sim({ scenario: scen({ player: { carried: 9 }, motes: [[0, 0, 0.5], [0.5, 0, 0], [0, 0, -0.5]] }), ticks: 1 });
  return (r.snaps[1].player.carried === 1 && cap.snaps[1].player.carried === 10 && cap.snaps[1].motes.length === 2) ||
    show([r.snaps[1].player, cap.snaps[1].player]);
});
test("AC1.5 motes: 20 distinct at start, +1 per 240 ticks at free points, cap 30", () => {
  const n1 = sim({ night: 1, scenario: { random_shades: false }, ticks: 1200 });
  const pts = new Set(n1.snaps[0].motes.map((m) => m.pos.join(",")));
  const n3 = sim({ night: 3, scenario: { random_shades: false, random_drifters: false, wind_enabled: false }, ticks: 2700 });
  const c = (r, t) => r.snaps[t].motes.length;
  // Night 1 has only 24 spawn points: spawning stops when none are free (skip turn).
  return (c(n1, 0) === 20 && pts.size === 20 && c(n1, 239) === 20 && c(n1, 240) === 21 && c(n1, 960) === 24 &&
    c(n1, 1200) === 24 && c(n3, 2400) === 30 && c(n3, 2640) === 30) ||
    show([c(n1, 0), pts.size, c(n1, 240), c(n1, 960), c(n1, 1200), c(n3, 2400), c(n3, 2640)]);
});
// [P3 UPDATED] (1) per_mote 10 -> 5: expected scores 70 -> 35 and 130 -> 115.
// (2) The old rule "lit lanterns are skipped" no longer exists — a lit lantern now accepts refuel.
//     The "skip" case moved L1 from 1.0 m to 1.8 m so it now checks "nearest eligible wins" (L2 at
//     1.5 m). Refuel selection itself is covered by P3.2/P3.3.
test("AC1.6 deposit: r=2.0, min(carried, missing), progress kept, nearest then lower id; +5/mote +100/lantern", () => {
  const a = sim({ scenario: scen({ player: { pos: [0, 0, 23.5], carried: 7 } }), frames: [{ tick: 0, interact: true }], ticks: 2 });
  const b = sim({ scenario: scen({ player: { pos: [0, 0, 23.5], carried: 5 }, lanterns: [{ id: "L1", deposited: 7 }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const tie = sim({ scenario: scen({ player: { carried: 3 }, lanterns: [{ id: "L2", pos: [0, 0, -2] }, { id: "L1", pos: [0, 0, 2] }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const skip = sim({ scenario: scen({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1.8], lit: true }, { id: "L2", pos: [0, 0, -1.5] }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const far = sim({ scenario: scen({ player: { pos: [0, 0, 22.9], carried: 3 } }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const da = a.ev("deposit")[0], db = b.ev("deposit")[0];
  return (da.data.amount === 7 && da.data.deposited === 7 && a.snaps[2].score === 35 &&
    db.data.amount === 3 && b.ev("lantern_lit").length === 1 && b.snaps[1].player.carried === 2 && b.snaps[1].score === 115 &&
    tie.ev("deposit")[0].data.lantern_id === "L1" && skip.ev("deposit")[0].data.lantern_id === "L2" &&
    far.ev("deposit").length === 0) || show([da, db, tie.events, skip.events]);
});
test("AC1.7 safe zone 6 m on lit lanterns only; shade inside when lit is ejected within 30 ticks, harmless", () => {
  // Chasing shade blocked at the edge of a lit lantern's zone.
  const a = sim({ scenario: scen({ player: { pos: [0, 0, 25] }, lanterns: [{ id: "L1", lit: true }], shades: [{ id: "S1", pos: [0, 1, 15] }] }), ticks: 200 });
  const dA = dist2(shade(a.snaps[200], "S1").pos, [0, 0, 25]);
  // Unlit lantern: no zone, the shade reaches the player.
  const b = sim({ scenario: scen({ player: { pos: [0, 0, 25] }, shades: [{ id: "S1", pos: [0, 1, 15] }] }), ticks: 200 });
  // Shade touching Mây when the lantern gets lit: pushed out, never hits.
  const c = sim({
    scenario: scen({ player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: "S1", pos: [0.5, 1, 23.5], state: "chase" }] }),
    frames: [{ tick: 0, interact: true }], ticks: 120,
  });
  const d29 = dist2(shade(c.snaps[29], "S1").pos, [0, 0, 25]), d30 = dist2(shade(c.snaps[30], "S1").pos, [0, 0, 25]);
  return (a.ev("player_hit").length === 0 && near(dA, 6, 1e-6) && b.ev("player_hit").length > 0 &&
    c.ev("player_hit").length === 0 && d29 < 6 - 0.05 && near(d30, 6, RND)) || show({ dA, hitsB: b.ev("player_hit").length, d29, d30, hitsC: c.ev("player_hit") });
});
test("AC1.8 pulse: needs 3 motes, 3D <=5 m from feet+0.8, stun 120, push 4 m over 15 ticks, +5 each", () => {
  const poor = sim({ scenario: scen({ player: { carried: 2 }, shades: [{ id: "S1", pos: [3, 1, 0] }] }), frames: [{ tick: 0, pulse: true }], ticks: 1 });
  const r = sim({ scenario: scen({ player: { carried: 3 }, shades: [{ id: "S1", pos: [3, 1, 0] }, { id: "S2", pos: [0, 6, 3] }] }), frames: [{ tick: 0, pulse: true }], ticks: 125 });
  const s = (t) => shade(r.snaps[t], "S1");
  const p = r.ev("pulse")[0];
  return (poor.ev("pulse").length === 0 && poor.snaps[1].player.carried === 2 &&
    show(p.data.stunned_ids) === '["S1"]' && r.snaps[1].player.carried === 0 && r.snaps[1].score === 5 &&
    near(s(15).pos[0], 7) && near(s(14).pos[0], 3 + 4 * 14 / 15, RND) && near(s(120).pos[0], 7) &&
    s(120).state === "stunned" && s(121).state === "chase" && near(r.snaps[1].player.pulse_cd_s, 3)) ||
    show({ p, s1: s(1), s15: s(15), s120: s(120), s121: s(121) });
});
test("AC1.8b pulse again refreshes stun (and costs 3 more)", () => {
  const r = sim({ scenario: scen({ player: { carried: 6 }, shades: [{ id: "S1", pos: [2, 1, 0] }] }),
    frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }, { tick: 180, pulse: true }], ticks: 320 });
  // 2nd pulse at tick 181 (S1 at x=6 is out of range 5 => not refreshed); move S1 closer instead:
  const r2 = sim({ scenario: scen({ player: { carried: 6, pulse_cd_ticks: 0 }, shades: [{ id: "S1", pos: [0.5, 1, 0], state: "stunned", state_ticks_left: 10 }] }),
    frames: [{ tick: 0, pulse: true }], ticks: 130 });
  return (r.ev("pulse").length === 2 && shade(r2.snaps[100], "S1").state === "stunned" && shade(r2.snaps[121], "S1").state !== "stunned") ||
    show([r.ev("pulse"), shade(r2.snaps[100], "S1")]);
});
test("AC1.9 shades: detect 12, give up 18, hit XZ<=1 & dy<=1.5, recoil 2 m / 60 ticks, 1 hit per tick by id", () => {
  const det = sim({ scenario: scen({ shades: [{ id: "S1", pos: [11, 1, 0] }, { id: "S2", pos: [20, 1, 0] }, { id: "S3", pos: [18.5, 1, 0], state: "chase" }, { id: "S4", pos: [17, 1, 0], state: "chase" }] }), ticks: 1 });
  const st = (id) => shade(det.snaps[1], id).state;
  const hit = sim({ scenario: scen({ player: { carried: 6 }, shades: [{ id: "S1", pos: [0.9, 1, 0] }] }), ticks: 61 });
  const h = hit.ev("player_hit")[0];
  const x60 = shade(hit.snaps[60], "S1").pos[0];
  const two = sim({ scenario: scen({ shades: [{ id: "S10", pos: [0.5, 1, 0] }, { id: "S2", pos: [-0.5, 1, 0] }] }), ticks: 1 });
  // Mây airborne at y=2.6 (falls to 2.594): gap to shade centre (y=1) is 1.594 > 1.5 => no hit.
  const high = sim({ scenario: scen({ player: { pos: [0, 2.6, 0] }, shades: [{ id: "S1", pos: [0.5, 1, 0] }] }), ticks: 1 });
  return (st("S1") === "chase" && st("S2") === "wander" && st("S3") === "wander" && st("S4") === "chase" &&
    h && h.tick === 1 && h.data.flames === 2 && h.data.dropped === 3 && shade(hit.snaps[1], "S1").state === "recoil" &&
    near(x60, 0.9 - 4 / 60 + 2, RND) && shade(hit.snaps[61], "S1").state === "chase" &&
    two.ev("player_hit").length === 1 && shade(two.snaps[1], "S2").state === "recoil" && shade(two.snaps[1], "S10").state === "chase" &&
    high.ev("player_hit").length === 0) ||
    show({ s: [st("S1"), st("S2"), st("S3"), st("S4")], h, x60, two: two.snaps[1].shades, high: high.events });
});
test("AC1.9b invulnerable 90 ticks after a hit; touching while invulnerable does nothing", () => {
  const r = sim({ scenario: scen({ player: { flames: 3 }, shades: [{ id: "S1", pos: [0.5, 1, 0] }, { id: "S2", pos: [-0.5, 1, 0.5] }] }), ticks: 200 });
  const t = r.ev("player_hit").map((e) => e.tick);
  return (t[0] === 1 && t[1] >= 91 && r.snaps[1].player.invuln === 1.5) || show(t);
});
test("AC1.10 spawn schedule: 2 at tick 300, then every 480 (N1) / 420 (N2), max 6/8, >=15 m from player", () => {
  const n1 = sim({ night: 1, scenario: { random_motes: false }, ticks: 3500 });
  const t1 = n1.ev("shade_spawned").map((e) => `${e.tick}:${e.data.id}`);
  const n2 = sim({ night: 2, scenario: { random_motes: false, random_drifters: false }, ticks: 1200 });
  const t2 = n2.ev("shade_spawned").map((e) => e.tick);
  const s300 = n1.snaps[300].shades;
  const okDist = s300.every((s) => Math.hypot(s.pos[0], s.pos[2]) >= 15);
  return (show(t1) === show(["300:S1", "300:S2", "780:S3", "1260:S4", "1740:S5", "2220:S6"]) &&
    show(t2) === show([300, 300, 720, 1140]) && s300.every((s) => s.state === "spawning") && okDist &&
    n1.snaps[330].shades.every((s) => s.state !== "spawning")) || show({ t1, t2, s300 });
});
test("AC1.11 hit: drop floor(carried/2) on a 1.5-2.5 m ring, TTL 480 ticks, pickable", () => {
  // 9 flames so repeated hits (every ~91 ticks) don't end the night before the TTL check.
  const r = sim({ scenario: scen({ player: { carried: 7, flames: 9 }, shades: [{ id: "S1", pos: [0.5, 1, 0], state: "chase" }] }), ticks: 482 });
  const drop = r.snaps[1].motes.filter((m) => m.kind === "dropped");
  const ring = drop.every((m) => { const d = Math.hypot(m.pos[0], m.pos[2]); return d >= 1.5 - 1e-3 && d <= 2.5 + 1e-3; });
  const ids = drop.map((m) => m.id);
  const alive480 = r.snaps[480].motes.filter((m) => ids.includes(m.id)).length;
  const alive481 = r.snaps[481].motes.filter((m) => ids.includes(m.id)).length;
  return (drop.length === 3 && r.snaps[1].player.carried === 4 && ring && near(drop[0].ttl_s, 8) && alive480 === 3 && alive481 === 0) ||
    show({ drop, alive480, alive481 });
});
test("AC1.12 fall (Y<-10): once, ignores invuln, loses all motes, waits 60, respawns at start with invuln 90", () => {
  const r = sim({ scenario: scen({ player: { pos: [39.5, 0, 0], carried: 4, invuln_ticks: 600 } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 200 });
  const falls = r.ev("player_hit");
  const f = falls[0];
  const after = r.snaps[f.tick + 60], before = r.snaps[f.tick + 59];
  const dead = sim({ scenario: scen({ player: { pos: [39.9, 0, 0], flames: 1 } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 300 });
  return (falls.length === 1 && f.data.by === "fall" && f.data.lost === 4 && f.data.flames === 2 &&
    r.snaps[f.tick].player.carried === 0 && before.player.pos[1] < -10 &&
    show(after.player.pos) === "[0,0,0]" && after.player.invuln === 1.5 &&
    dead.ev("game_over")[0]?.data.reason === "no_flames") || show({ falls, after: after?.player, dead: dead.ev("game_over") });
});
// [P3 UPDATED] TICKET-03 removed the early win: reason "all_lit" no longer exists. Case b now checks
// that 5/5 lit at the dawn tick gives "dawn_survived"; cases a (no_flames first) and c (dawn) unchanged.
test("AC1.13 judge order: no_flames first; at dawn enough lit => dawn_survived, else dawn", () => {
  const allLit = ["L1", "L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const a = sim({ scenario: scen({ player: { flames: 0 }, lanterns: allLit }), ticks: 5 });
  const b = sim({ scenario: scen({ lanterns: allLit.slice(1), player: { pos: [0, 0, 23.5], carried: 10 }, time_left_s: 1 / 60 }), frames: [{ tick: 0, interact: true }], ticks: 5 });
  const c = sim({ scenario: scen({ time_left_s: 0.5 }), ticks: 100 });
  const g = (r) => r.ev("game_over")[0];
  return (g(a).data.reason === "no_flames" && g(b).data.reason === "dawn_survived" && g(b).tick === 1 &&
    g(c).data.reason === "dawn" && g(c).tick === 30) ||
    show([g(a), g(b), g(c)]);
});
// [P3 REMOVED] AC1.14 "win score: 10/mote + 100/lantern + floor(sec left)x2 + 50/flame" was deleted:
// TICKET-03 replaces the whole score formula (time bonus dropped, early win dropped). Its successor
// is P3.17 below, which checks the new dawn bonus.
// [P3 UPDATED] Night 1 now lasts 240 s (was 300 s): expected time_left_s changed accordingly.
test("AC1.15 pause: tick advances, sim_tick/time/cooldowns/movement freeze; paused/resumed events", () => {
  const r = sim({ scenario: scen({ player: { pulse_cd_ticks: 100 } }), frames: [{ tick: 0, move: [0, 1] }, { tick: 10, pause: true }, { tick: 11, pause: false }, { tick: 20, pause: true }, { tick: 21, pause: false }], ticks: 25 });
  const s15 = r.snaps[15], s11 = r.snaps[11], s21 = r.snaps[21];
  return (r.ev("paused")[0].tick === 11 && r.ev("resumed")[0].tick === 21 && s15.state === "paused" && s15.sim_tick === 10 &&
    near(s15.time_left_s, 240 - 10 / 60, 1e-3) && near(s15.player.pos[2], 1.0) && s11.player.pulse_cd_s === s15.player.pulse_cd_s &&
    s21.sim_tick === 11 && s21.state === "playing" && near(s21.player.pos[2], 1.1)) || show({ s11: s11.player, s15, s21: s21.player });
});

console.log("— B. Maps —");

test("AC2.1 Night 1 lanterns at ticket coordinates; island radius 40", () => {
  const r = sim({ night: 1, scenario: scen(), ticks: 0 });
  const want = [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]];
  return show(r.snaps[0].lanterns.map((l) => l.pos)) === show(want) || show(r.snaps[0].lanterns);
});
test("AC2.2 Night 2: bridge walkable, no rails; jump pad flies ~1.4 s to the other island", () => {
  const walk = sim({ night: 2, scenario: scen({ player: { pos: [25, 0, 0] } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 240 });
  const side = sim({ night: 2, scenario: scen({ player: { pos: [35, 0, 0] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 120 });
  const pad = sim({ night: 2, scenario: scen({ player: { pos: [20, 0, 18] } }), ticks: 150 });
  const land = pad.snaps.findIndex((s, i) => i > 2 && s.player.grounded);
  const lp = pad.snaps[land].player.pos;
  return (walk.ev("player_hit").length === 0 && near(walk.snaps[240].player.pos[0], 49) &&
    side.ev("player_hit")[0]?.data.by === "fall" && pad.ev("player_hit").length === 0 &&
    land >= 80 && land <= 90 && Math.hypot(lp[0] - 70, lp[2]) <= 28) || show({ walkEnd: walk.snaps[240].player, side: side.events, land, lp });
});
test("AC2.3 Night 3: tier walls block, ramp climbs to Y=3, pad lands on tier 2, bell tower blocks", () => {
  const wall = sim({ night: 3, scenario: scen({ player: { pos: [0, 0, -12] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 120 });
  const c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
  const ramp = sim({ night: 3, scenario: scen({ player: { pos: [30.5 * c30, 0, 30.5 * s30] } }), frames: [{ tick: 0, move: [-c30, -s30] }], ticks: 90 });
  const pad = sim({ night: 3, scenario: scen({ player: { pos: [0, 3, 13] } }), ticks: 90 });
  const tower = sim({ night: 3, scenario: scen({ player: { pos: [0, 6, -5] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 120 });
  const w = wall.snaps[120].player.pos, rp = ramp.snaps[90].player, pp = pad.snaps[90].player, tp = tower.snaps[120].player.pos;
  return (w[1] === 0 && w[2] <= -8 + 1e-6 && w[2] > -8.2 && rp.pos[1] === 3 && rp.grounded &&
    pp.pos[1] === 6 && pp.grounded && Math.hypot(pp.pos[0], pp.pos[2]) <= 8 && tp[1] === 6 && tp[2] <= -2 && tp[2] > -2.2) ||
    show({ w, rp, pp, tp });
});
test("AC2.4 Night 3 wind: every 30 s for 5 s at 2 m/s, seeded direction; off when wind_enabled=false", () => {
  const sc = { random_motes: false, random_shades: false, random_drifters: false };
  const r = sim({ night: 3, scenario: sc, ticks: 2101 });
  const off = sim({ night: 3, scenario: { ...sc, wind_enabled: false }, ticks: 1900 });
  const a = r.snaps[1799].player.pos, b = r.snaps[2099].player.pos;
  return (!r.snaps[1799].wind.active && r.snaps[1800].wind.active && r.snaps[2099].wind.active && !r.snaps[2100].wind.active &&
    near(Math.hypot(b[0] - a[0], b[2] - a[2]), 10, RND) && !off.snaps[1850].wind.active) ||
    show({ w: [r.snaps[1799].wind, r.snaps[1800].wind, r.snaps[2100].wind], a, b });
});

console.log("— C. New features —");

test("AC3.1 drifters spawn at 1200, 2400…, max 2 alive, ids D1, D2 (nights 2-3 only)", () => {
  const r = sim({ night: 2, scenario: { random_motes: false, random_shades: false }, ticks: 3700 });
  const n1 = sim({ night: 1, scenario: { random_motes: false, random_shades: false }, ticks: 1300 });
  return (r.snaps[1199].drifters.length === 0 && show(r.snaps[1200].drifters.map((d) => d.id + d.state)) === '["D1idle"]' &&
    r.snaps[2400].drifters.length === 2 && r.snaps[3600].drifters.length === 2 && n1.snaps[1300].drifters.length === 0) ||
    show(r.snaps[3600].drifters);
});
test("AC3.2 drifter idle -> chase when carrying >=5 within 15 m; back to idle when lost", () => {
  const a = sim({ night: 2, scenario: scen({ player: { carried: 5 }, drifters: [{ id: "D1", pos: [10, 1.2, 0] }] }), ticks: 1 });
  const b = sim({ night: 2, scenario: scen({ player: { carried: 4 }, drifters: [{ id: "D1", pos: [10, 1.2, 0] }] }), ticks: 1 });
  const c = sim({ night: 2, scenario: scen({ player: { carried: 5 }, drifters: [{ id: "D1", pos: [15.5, 1.2, 0], state: "chase" }] }), ticks: 1 });
  return (a.snaps[1].drifters[0].state === "chase" && b.snaps[1].drifters[0].state === "idle" && c.snaps[1].drifters[0].state === "idle") ||
    show([a.snaps[1].drifters, b.snaps[1].drifters, c.snaps[1].drifters]);
});
test("AC3.3 drifter touch steals min(3,carried) even when invulnerable; flees 240 ticks then removed", () => {
  const r = sim({ night: 2, scenario: scen({ player: { carried: 7, invuln_ticks: 300 }, drifters: [{ id: "D1", pos: [1.0, 1.2, 0] }] }), ticks: 245 });
  const s = r.ev("drifter_steal")[0];
  return (s && s.tick === 1 && s.data.amount === 3 && s.data.carried === 4 && r.snaps[1].drifters[0].stolen === 3 &&
    r.snaps[240].drifters[0].state === "flee" && r.snaps[241].drifters[0].state === "removed" &&
    r.ev("drifter_steal").length === 1 && r.snaps[245].player.flames === 3) || show({ s, d240: r.snaps[240].drifters, d241: r.snaps[241].drifters });
});
test("AC3.4 pulse: chasing drifter flees without stealing; fleeing drifter drops its loot, vanishes after 120", () => {
  const a = sim({ night: 2, scenario: scen({ player: { carried: 8 }, drifters: [{ id: "D1", pos: [4, 1.2, 0], state: "chase" }] }), frames: [{ tick: 0, pulse: true }], ticks: 30 });
  const b = sim({ night: 2, scenario: scen({ player: { carried: 3 }, drifters: [{ id: "D1", pos: [3, 1.2, 0], state: "flee", stolen: 3 }] }), frames: [{ tick: 0, pulse: true }], ticks: 125 });
  const drop = b.ev("drifter_drop")[0];
  const dm = b.snaps[1].motes.filter((m) => m.kind === "dropped");
  return (a.snaps[1].drifters[0].state === "flee" && a.ev("drifter_steal").length === 0 && a.snaps[30].player.carried === 5 &&
    drop && drop.data.amount === 3 && dm.length === 3 && b.snaps[120].drifters[0].state === "flee" &&
    b.snaps[121].drifters[0].state === "removed") || show({ a: a.snaps[1].drifters, drop, dm, d121: b.snaps[121].drifters });
});
test("AC3.5 charm: 600 ticks, run 7.2 m/s, dash without cooldown, press during dash ignored, re-pick refreshes", () => {
  const r = sim({ night: 2, scenario: scen({ player: { pos: [34.5, 0, 0] }, charms: [{ id: "C1" }] }), frames: [{ tick: 0, move: [1, 0] }], ticks: 60 });
  const pk = r.ev("charm_picked")[0];
  const x60 = r.snaps[60].player.pos[0];
  const d = sim({ night: 1, scenario: scen({ player: { charm_ticks: 600 } }),
    frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 5, dash: true }, { tick: 6, dash: false }, { tick: 20, dash: true }], ticks: 30 });
  const rp = sim({ night: 1, scenario: scen({ charms: [{ id: "C1", pos: [0, 0, 0.5] }, { id: "C2", pos: [0, 0, 3] }] }), frames: [{ tick: 0, move: [0, 1] }], ticks: 40 });
  const picks = rp.ev("charm_picked");
  return (pk && pk.tick === 1 && show(pk.data) === '{"charm_id":"C1","charm_ticks":600}' && r.snaps[1].player.charm_s === 10 &&
    near(x60, 34.5 + 0.1 + 59 * 0.12) && show(d.ev("dash").map((e) => e.tick)) === "[1,21]" &&
    picks.length === 2 && rp.snaps[picks[1].tick].player.charm_s === 10) || show({ pk, x60, dash: d.ev("dash"), picks });
});
test("AC3.6 charm respawns after 2700 ticks; standard positions per night", () => {
  const r = sim({ night: 2, scenario: scen({ player: { pos: [35, 0, 0] }, charms: [{ id: "C1" }] }), ticks: 2702 });
  const n3 = sim({ night: 3, scenario: scen({ charms: undefined }), ticks: 0 });
  const c = (t) => r.snaps[t].charms[0];
  // Mây stands on the charm, so it is re-picked the tick it reappears.
  return (!c(1).available && c(1).respawn_s === 45 && !c(2700).available && r.ev("charm_picked").map((e) => e.tick).join() === "1,2701" &&
    show(n3.snaps[0].charms.map((q) => q.pos)) === "[[30,0,25],[-30,0,25]]") || show({ c1: c(1), c2700: c(2700), ev: r.ev("charm_picked"), n3: n3.snaps[0].charms });
});

console.log("— D. Contract v1.1 —");

test("AC4.2 --night 1|2|3 selects 5/6/7 lanterns", () => {
  const n = [1, 2, 3].map((night) => sim({ night, scenario: scen(), ticks: 0 }).snaps[0]);
  return show(n.map((s) => [s.night, s.lanterns.length])) === "[[1,5],[2,6],[3,7]]" || show(n.map((s) => s.lanterns.length));
});
test("AC4.3 snapshot carries every v1.1 field", () => {
  const s = sim({ night: 2, ticks: 1 }).snaps[1];
  const need = ["night", "wind", "player", "lanterns", "shades", "motes", "motes_active", "drifters", "charms", "sim_tick", "time_left_s", "score", "state"];
  const pNeed = ["pos", "vel", "grounded", "flames", "carried", "invuln", "dash_cd_s", "pulse_cd_s", "charm_s"];
  const miss = need.filter((k) => !(k in s)).concat(pNeed.filter((k) => !(k in s.player)));
  const m = s.motes[0];
  return (miss.length === 0 && "active" in s.wind && "dir_deg" in s.wind && m.kind === "random" && m.ttl_s === null &&
    ["id", "available", "respawn_s"].every((k) => k in s.charms[0])) || `missing: ${miss}`;
});
test("AC4.4 scenario accepts player.{invuln,dash_cd,pulse_cd,charm}_ticks and shades[].state/state_ticks_left", () => {
  const s = sim({ scenario: scen({ player: { invuln_ticks: 30, dash_cd_ticks: 60, pulse_cd_ticks: 90, charm_ticks: 120 }, shades: [{ id: "S7", pos: [30, 1, 0], state: "stunned", state_ticks_left: 5 }] }), ticks: 6 });
  const p = s.snaps[0].player;
  return (p.invuln === 0.5 && p.dash_cd_s === 1 && p.pulse_cd_s === 1.5 && p.charm_s === 2 &&
    shade(s.snaps[4], "S7").state === "stunned" && shade(s.snaps[5], "S7").state !== "stunned") || show([p, s.snaps[5].shades]);
});
// [P3 UPDATED] "drain" is a legal shade state since Contract v1.2.
test("AC4.5 shade states only from {spawning, wander, chase, recoil, stunned, drain}", () => {
  const ok = new Set(["spawning", "wander", "chase", "recoil", "stunned", "drain"]);
  const seen = new Set();
  for (const night of [1, 2, 3]) {
    const r = sim({ night, seed: 3, frames: [{ tick: 0, move: [0.3, 1] }], ticks: 6000 });
    for (const sn of r.snaps) for (const s of sn.shades) seen.add(s.state);
  }
  // carried 7: the hit drops 3, leaving 4 >= pulse_cost for the stun.
  const hit = sim({ scenario: scen({ player: { carried: 7 }, shades: [{ id: "S1", pos: [0.5, 1, 0] }] }), frames: [{ tick: 30, pulse: true }], ticks: 40 });
  for (const sn of hit.snaps) for (const s of sn.shades) seen.add(s.state);
  const bad = [...seen].filter((x) => !ok.has(x));
  return (bad.length === 0 && seen.size >= 5) || show([...seen]);
});
test("AC4.6 a full night (21 600 ticks) runs headless in <= 30 s", () => {
  const out = path.join(tmp, "perf.jsonl");
  const t0 = Date.now();
  const code = cli(["--seed", "11", "--night", "3", "--ticks", "21600", "--out", out, "--snapshot-every", "1"]);
  const ms = Date.now() - t0;
  console.log(`        (night 3, snapshot every tick: ${ms} ms)`);
  return (code === 0 && ms <= 30000) || `code=${code} ms=${ms}`;
});

console.log("— Phase 3: TICKET-03 (Contract v1.2) —");

const L1AT = [0, 0, 23.5]; // 1.5 m from L1 (0,0,25): within interact radius
const lan = (snap, id = "L1") => snap.lanterns.find((l) => l.id === id);

test("P3.1 lighting sets fuel 100; lit lanterns lose exactly 1.0 fuel per second", () => {
  const r = sim({ scenario: scen({ player: { pos: L1AT, carried: 10 } }), frames: [{ tick: 0, interact: true }], ticks: 61 });
  return (lan(r.snaps[1]).fuel === 100 && lan(r.snaps[61]).fuel === 99 && lan(r.snaps[0]).fuel === 0) ||
    show([lan(r.snaps[1]), lan(r.snaps[61])]);
});
test("P3.2 refuel: used = min(carried, ceil((100-fuel)/10)), fuel capped at 100, +5 per mote, event refuel", () => {
  const run = (fuel, carried) => sim({ scenario: scen({ player: { pos: L1AT, carried }, lanterns: [{ id: "L1", lit: true, fuel }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const a = run(55, 7), b = run(95, 3), c = run(20, 2);
  const e = (r) => r.ev("refuel")[0]?.data;
  // a: 54.983 -> need 5 -> 100.0, 2 left; b: need 1 -> 100.0; c: only 2 carried -> 19.983 + 20 = 39.983 -> 40.0
  return (show(e(a)) === '{"lantern_id":"L1","amount":5,"fuel":100}' && a.snaps[1].player.carried === 2 && a.snaps[1].score === 25 &&
    e(b).amount === 1 && e(b).fuel === 100 && e(c).amount === 2 && e(c).fuel === 40 && c.snaps[1].player.carried === 0 &&
    a.ev("deposit").length === 0) || show([e(a), e(b), e(c)]);
});
test("P3.3 selection among eligible lanterns (unlit, or lit & not full): nearest, tie -> lower id", () => {
  // L1 lit (refuel) at 1.0 m vs L2 unlit at 1.5 m -> refuel L1.
  const a = sim({ scenario: scen({ player: { carried: 3 }, lanterns: [{ id: "L1", pos: [0, 0, 1], lit: true, fuel: 50 }, { id: "L2", pos: [0, 0, -1.5] }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  // Tie at 1.5 m between lit L3 (refuel) and unlit L2 -> L2 (lower id).
  const b = sim({ scenario: scen({ player: { carried: 3 }, lanterns: [{ id: "L3", pos: [0, 0, 1.5], lit: true, fuel: 50 }, { id: "L2", pos: [0, 0, -1.5] }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  return (a.ev("refuel")[0]?.data.lantern_id === "L1" && b.ev("deposit")[0]?.data.lantern_id === "L2") || show([a.events, b.events]);
});
test("P3.4 fuel <= 0 -> goes out right after step 2: lantern_out, deposited 0, ever_lit, fuel 0", () => {
  const r = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true, fuel: 0.05 }] }), ticks: 4 }); // 3 units
  const out = r.ev("lantern_out");
  const l3 = lan(r.snaps[3]);
  return (out.length === 1 && out[0].tick === 3 && lan(r.snaps[2]).lit && !l3.lit && l3.fuel === 0 && l3.deposited === 0 && l3.ever_lit) ||
    show({ out, l2: lan(r.snaps[2]), l3 });
});
test("P3.5 relight costs 5 (ever_lit), +40, relight:true, relit_count+1; never-lit still costs 10", () => {
  const a = sim({ scenario: scen({ player: { pos: L1AT, carried: 5 }, lanterns: [{ id: "L1", ever_lit: true }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const b = sim({ scenario: scen({ player: { pos: L1AT, carried: 5 } }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const lit = a.ev("lantern_lit")[0];
  return (lit?.data.relight === true && lan(a.snaps[1]).relit_count === 1 && lan(a.snaps[1]).fuel === 100 && a.snaps[1].score === 25 + 40 &&
    b.ev("lantern_lit").length === 0 && lan(b.snaps[1]).deposited === 5) || show([a.events, lan(a.snaps[1]), b.events]);
});
test("P3.6 safe zone needs fuel >= 30: exactly 30 still blocks, 29.98 does not", () => {
  const run = (fuel) => sim({ scenario: scen({ player: { pos: [0, 0, 25] }, lanterns: [{ id: "L1", lit: true, fuel }], shades: [{ id: "S1", pos: [0, 1, 31.05], state: "chase" }] }), ticks: 1 });
  const at30 = run(30 + 1 / 60), below = run(30); // after tick-1 decay: exactly 30.0 vs 29.983
  const d = (r) => dist2(shade(r.snaps[1], "S1").pos, [0, 0, 25]);
  return (near(d(at30), 6, 1e-3) && near(d(below), 6.05 - 4 / 60, 1e-3)) || show([d(at30), d(below)]);
});
test("P3.7 only wander shades seek the nearest weak lantern, drain within 2 m; 5/s each + 1/s decay, stacking", () => {
  const r = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 1, 30] }] }), ticks: 200 });
  const startTick = r.snaps.findIndex((s) => shade(s, "S1").state === "drain");
  const f0 = lan(r.snaps[startTick + 10]).fuel, f1 = lan(r.snaps[startTick + 70]).fuel; // 60 ticks of draining
  const two = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [
    { id: "S1", pos: [0, 1, 26.5], state: "drain", target_lantern_id: "L1" }, { id: "S2", pos: [1, 1, 26], state: "drain", target_lantern_id: "L1" }] }), ticks: 60 });
  const chaser = sim({ scenario: scen({ player: { pos: [0, 0, 36] }, lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 1, 30], state: "chase" }] }), ticks: 30 });
  return (startTick > 30 && startTick < 60 && near(f0 - f1, 6, 0.11) && near(lan(two.snaps[60]).fuel, 25 - 11, 0.11) &&
    shade(chaser.snaps[30], "S1").state === "chase" && shade(chaser.snaps[30], "S1").pos[2] > 30) ||
    show({ startTick, f0, f1, two: lan(two.snaps[60]).fuel, chaser: shade(chaser.snaps[30], "S1") });
});
test("P3.8 fuel_drain event every 60 ticks of draining, with the fuel left", () => {
  const r = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 1, 26.5], state: "drain", target_lantern_id: "L1" }] }), ticks: 125 });
  const ev = r.ev("fuel_drain");
  // 25 - 60*(1+5)/60 = 19.0 at tick 60; 13.0 at tick 120
  return (show(ev.map((e) => [e.tick, e.data.fuel])) === "[[60,19],[120,13]]" && ev[0].data.shade_id === "S1" && ev[0].data.lantern_id === "L1") || show(ev);
});
test("P3.9 drain exits: Mây within 6 m -> chase; lantern out -> wander; stun -> +15 and ends in wander", () => {
  const near6 = sim({ scenario: scen({ player: { pos: [0, 0, 21] }, lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 1, 26.5], state: "drain", target_lantern_id: "L1" }] }), ticks: 1 });
  const out = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true, fuel: 0.05 }], shades: [{ id: "S1", pos: [0, 1, 26.5], state: "drain", target_lantern_id: "L1" }] }), ticks: 1 });
  const stun = sim({ scenario: scen({ player: { pos: [0, 0, 22], carried: 3 }, lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0, 1, 26.5], state: "drain", target_lantern_id: "L1" }] }), frames: [{ tick: 0, pulse: true }], ticks: 1 });
  // Stun ending at 15 m from Mây: Phase-2 rule would give "chase" (<= 18 m); TICKET-03 says "wander".
  const end = sim({ scenario: scen({ shades: [{ id: "S1", pos: [15, 1, 0], state: "stunned", state_ticks_left: 1 }] }), ticks: 1 });
  return (shade(near6.snaps[1], "S1").state === "chase" && out.ev("lantern_out").length === 1 && shade(out.snaps[1], "S1").state === "wander" &&
    stun.snaps[1].score === 15 && shade(stun.snaps[1], "S1").state === "stunned" && shade(end.snaps[1], "S1").state === "wander") ||
    show([near6.snaps[1].shades, out.snaps[1].shades, stun.snaps[1].score, end.snaps[1].shades]);
});
test("P3.10 refuel back to >= 30 with a shade inside 6 m: pushed to the edge within 30 ticks, harmless", () => {
  const r = sim({ scenario: scen({ player: { pos: L1AT, carried: 10 }, lanterns: [{ id: "L1", lit: true, fuel: 25 }], shades: [{ id: "S1", pos: [0.5, 1, 23.5], state: "chase" }] }),
    frames: [{ tick: 0, interact: true }], ticks: 60 });
  const d30 = dist2(shade(r.snaps[30], "S1").pos, [0, 0, 25]);
  return (r.ev("refuel").length === 1 && r.ev("player_hit").length === 0 && near(d30, 6, RND)) || show({ d30, ev: r.events });
});
test("P3.11 night lengths 240 / 270 / 300 s", () => {
  const t = [1, 2, 3].map((night) => sim({ night, scenario: scen(), ticks: 0 }).snaps[0].time_left_s);
  return show(t) === "[240,270,300]" || show(t);
});
test("P3.12 lighting every lantern does NOT end the night", () => {
  const lit = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true }));
  const r = sim({ scenario: scen({ lanterns: lit, player: { pos: L1AT, carried: 10 } }), frames: [{ tick: 0, interact: true }], ticks: 120 });
  return (r.snaps[1].lanterns.every((l) => l.lit) && r.ev("game_over").length === 0 && r.snaps[120].state === "playing") || show(r.events);
});
test("P3.13 dawn: alive and lit >= ceil(0.6 x total) (3/5, 4/6, 5/7) => won dawn_survived, else lost dawn", () => {
  const ids = ["L1", "L2", "L3", "L4", "L5", "L6", "L7"];
  const run = (night, k) => sim({ night, scenario: scen({ lanterns: ids.slice(0, k).map((id) => ({ id, lit: true })), time_left_s: 0.5 }), ticks: 40 }).ev("game_over")[0]?.data.reason;
  const got = [run(1, 3), run(1, 2), run(2, 4), run(2, 3), run(3, 5), run(3, 4)];
  return show(got) === show(["dawn_survived", "dawn", "dawn_survived", "dawn", "dawn_survived", "dawn"]) || show(got);
});
test("P3.14 running out of flames on the dawn tick still loses with no_flames", () => {
  const r = sim({ scenario: scen({ player: { flames: 1 }, lanterns: ["L1", "L2", "L3"].map((id) => ({ id, lit: true })), shades: [{ id: "S1", pos: [0.5, 1, 0], state: "chase" }], time_left_s: 1 / 60 }), ticks: 3 });
  const g = r.ev("game_over")[0];
  return (g.tick === 1 && g.data.result === "lost" && g.data.reason === "no_flames") || show(g);
});
test("P3.15 capacity = min(20, 10 + 2 x successful_lights); relights count, preset lanterns don't", () => {
  const a = sim({ scenario: scen({ player: { pos: L1AT, carried: 10 } }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const relit = sim({ scenario: scen({ player: { pos: L1AT, carried: 5 }, lanterns: [{ id: "L1", ever_lit: true }] }), frames: [{ tick: 0, interact: true }], ticks: 1 });
  const preset = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true }] }), ticks: 0 });
  const cap = (n) => sim({ scenario: scen({ player: { successful_lights: n } }), ticks: 0 }).snaps[0].player.capacity;
  const pick = sim({ scenario: scen({ player: { successful_lights: 1, carried: 11 }, motes: [[0, 0, 0.5], [0.5, 0, 0]] }), ticks: 1 });
  return (a.snaps[0].player.capacity === 10 && a.snaps[1].player.capacity === 12 && relit.snaps[1].player.capacity === 12 &&
    preset.snaps[0].player.capacity === 10 && cap(5) === 20 && cap(9) === 20 && pick.snaps[1].player.carried === 12) ||
    show([a.snaps[1].player.capacity, relit.snaps[1].player.capacity, cap(5), cap(9), pick.snaps[1].player.carried]);
});
test("P3.17 dawn bonus: each lit lantern 50 + floor(fuel), each flame 50; no time bonus", () => {
  const lit = ["L2", "L3", "L4", "L5"].map((id) => ({ id, lit: true, fuel: 50 }));
  const r = sim({ scenario: scen({ lanterns: lit, player: { pos: L1AT, carried: 10, flames: 2 }, time_left_s: 1 }), frames: [{ tick: 0, interact: true }], ticks: 70 });
  // deposit 10x5=50, first light 100; at dawn (tick 60): L1 fuel 99.02 -> 50+99, L2-L5 fuel 49.0 -> 4x(50+49), flames 2x50
  const want = 50 + 100 + (50 + 99) + 4 * (50 + 49) + 2 * 50;
  const over = r.ev("game_over")[0];
  return (over?.tick === 60 && over.data.reason === "dawn_survived" && r.snaps.at(-1).score === want) || show({ over, score: r.snaps.at(-1).score, want });
});
test("P3.22/23 snapshot + scenario v1.2 fields (fuel 1 dp, ever_lit, relit_count, capacity, target_lantern_id)", () => {
  const s = sim({ scenario: scen({ lanterns: [{ id: "L1", lit: true }, { id: "L2", lit: true, fuel: 12.34 }, { id: "L3", ever_lit: true, relit_count: 2 }],
    shades: [{ id: "S1", pos: [0, 1, 26.5], state: "drain", target_lantern_id: "L1" }] }), ticks: 0 }).snaps[0];
  const [l1, l2, l3] = s.lanterns;
  return (l1.fuel === 100 && l1.ever_lit && l2.fuel === 12.3 && !l3.lit && l3.fuel === 0 && l3.ever_lit && l3.relit_count === 2 &&
    s.player.capacity === 10 && s.shades[0].state === "drain" && s.shades[0].target_lantern_id === "L1") || show([l1, l2, l3, s.shades[0]]);
});

console.log("— Phase 4: TICKET-04 (Contract v1.3) —");
{
  const { buildBenchScenario, benchCamera, BENCH } = await import("../src/bench/scene.js");
  const { benchStats } = await import("../src/bench/stats.js");
  const { makeSoakInput, runNight } = await import("./soak.js");
  const LB = await import("../src/leaderboard.js");

  test("P4.1 bench scene: 200 wander shades + 100 motes spread on the island (seed 42), L1-L3 lit fuel 100, Mây at origin", () => {
    const sc = buildBenchScenario(42);
    const g = new Game({ seed: 42, night: 1, scenario: sc, bench: true });
    const s0 = snapshotLine(g);
    const inIsland = s0.shades.every((s) => Math.hypot(s.pos[0], s.pos[2]) <= 40) && s0.motes.every((m) => Math.hypot(m.pos[0], m.pos[2]) <= 40);
    const outsideZones = s0.shades.every((s) => s0.lanterns.slice(0, 3).every((l) => dist2(s.pos, l.pos) >= 6));
    const quadrants = [0, 0, 0, 0];
    for (const s of s0.shades) quadrants[(s.pos[0] >= 0 ? 0 : 1) + (s.pos[2] >= 0 ? 0 : 2)]++;
    const again = JSON.stringify(buildBenchScenario(42)) === JSON.stringify(sc);
    return (s0.shades.length === 200 && s0.shades.every((s) => s.state === "wander") && s0.motes.length === 100 &&
      show(s0.lanterns.map((l) => [l.lit, l.fuel])) === "[[true,100],[true,100],[true,100],[false,0],[false,0]]" &&
      show(s0.player.pos) === "[0,0,0]" && inIsland && outsideZones && quadrants.every((q) => q > 30) && again) ||
      show({ n: s0.shades.length, m: s0.motes.length, inIsland, outsideZones, quadrants, again });
  });
  test("P4.2 bench disables spawns, damage, pickups, fuel decay and night end; shades still wander", () => {
    const g = new Game({ seed: 42, night: 1, scenario: buildBenchScenario(42), bench: true });
    const before = g.shades.map((s) => [s.x, s.z]);
    const names = new Set();
    const NO = { move: [0, 0], camYaw: 0 };
    for (let k = 0; k < 60 * 40; k++) for (const e of g.step(NO)) names.add(e.name);
    const moved = g.shades.filter((s, i) => Math.hypot(s.x - before[i][0], s.z - before[i][1]) > 0.5).length;
    const s = snapshotLine(g);
    return (names.size === 0 && g.state === "playing" && s.shades.length === 200 && s.motes.length === 100 &&
      s.lanterns.slice(0, 3).every((l) => l.fuel === 100) && s.player.flames === 3 && s.shades.every((x) => x.state === "wander") && moved > 150) ||
      show({ names: [...names], state: g.state, moved, fuel: s.lanterns.map((l) => l.fuel) });
  });
  test("P4.3 bench camera: r=30, y=15, starts at (30,15,0), counter-clockwise (ticket angle convention), 15 s per lap", () => {
    const at = (t) => benchCamera(t).map((v) => +v.toFixed(6));
    return (show(at(0)) === "[30,15,0]" && show(at(3.75)) === "[0,15,30]" && show(at(7.5)) === "[-30,15,0]" &&
      show(at(15)) === "[30,15,0]" && BENCH.warmupS === 3) || show([at(0), at(3.75), at(7.5), at(15)]);
  });
  test("P4.5 bench stats: avg = 1000N/sum, p1 low = 1000/mean(k worst), k = max(1, ceil(0.01N)), p95 nearest-rank", () => {
    const a = benchStats([...Array(99).fill(10), 100]); // N=100: k=1 -> worst 100 ms -> 10 fps
    const b = benchStats([...Array(247).fill(5), 40, 50, 60]); // N=250: k=3 -> mean 50 -> 20 fps
    return (a.frames === 100 && a.avg_fps === 91.7 && a.p1_low_fps === 10 && a.frame_ms_p95 === 10 &&
      b.frames === 250 && b.p1_low_fps === 20 && b.frame_ms_p95 === 5 && b.avg_fps === +(1000 * 250 / (247 * 5 + 150)).toFixed(1)) || show([a, b]);
  });
  test("P4.6 soak inputs are seeded (same seed => same stream) with the ticket's rates; a night runs to its end", () => {
    const take = (seed) => { const f = makeSoakInput(seed); return Array.from({ length: 6000 }, (_, t) => { const i = f(t); return [i.move[0], i.jump, i.dash, i.pulse, i.interact]; }); };
    const x = take(7), y = take(7), z = take(8);
    const rate = (j) => x.filter((r) => r[j]).length / x.length;
    const dirChanges = x.filter((r, t) => t > 0 && r[0] !== x[t - 1][0]).length;
    const { res } = runNight(1, 7);
    return (JSON.stringify(x) === JSON.stringify(y) && JSON.stringify(x) !== JSON.stringify(z) &&
      near(rate(1), 0.05, 0.01) && near(rate(2), 0.03, 0.01) && near(rate(3), 0.02, 0.01) && near(rate(4), 0.10, 0.015) &&
      dirChanges <= 200 && ["won", "lost"].includes(res.result)) || show({ rates: [1, 2, 3, 4].map(rate), dirChanges, res });
  });
  test("P4.7 leaderboard: names 3-12 [A-Za-z0-9_] (+ Vietnamese), ISO time zone, top 10, score desc then earliest first", () => {
    const names = ["ab", "abc", "Mây_đêm1", "a b c", "abcdefghijklm", "x-y-z", "Nguyễn_An"].map((n) => LB.validateName(n).ok);
    const e = (name, score, at) => ({ name, score, nights_won: 1, achieved_at: at, seed: 1 });
    let board = [];
    board = LB.addEntry(board, e("late", 500, "2026-11-20T10:00:00+07:00")).entries;
    board = LB.addEntry(board, e("early", 500, "2026-11-20T09:00:00+07:00")).entries;
    board = LB.addEntry(board, e("top", 900, "2026-11-21T09:00:00+07:00")).entries;
    for (let i = 0; i < 9; i++) board = LB.addEntry(board, e(`p${i}xx`, 100 + i, "2026-11-19T00:00:00Z")).entries;
    const iso = LB.isoWithOffset(new Date());
    return (show(names) === "[false,true,true,false,false,false,true]" && board.length === 10 &&
      show(board.slice(0, 3).map((x) => x.name)) === '["top","early","late"]' && board.at(-1).score === 102 &&
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(iso) && LB.validateEntry(e("okay", 1, "2026-11-20T10:00:00")).ok === false) ||
      show({ names, board: board.map((x) => `${x.name}:${x.score}`), iso });
  });
  test("P4.8 --export-leaderboard writes {entries:[...]} ranked, top 10, invalid rows dropped", () => {
    const file = path.join(tmp, "lb.json"), out = path.join(tmp, "lb-out.json");
    const rows = Array.from({ length: 12 }, (_, i) => ({ name: `player${i}`, score: (i * 37) % 11 * 10, nights_won: i % 4, achieved_at: `2026-11-${10 + i}T12:00:00+07:00`, seed: i }));
    rows.push({ name: "x", score: 9999, nights_won: 3, achieved_at: "2026-11-01T00:00:00Z", seed: 0 }); // invalid name
    fs.writeFileSync(file, JSON.stringify({ entries: rows }));
    execFileSync("node", [path.join(root, "server.js"), "--export-leaderboard", out], { env: { ...process.env, DDL_LEADERBOARD: file } });
    const got = JSON.parse(fs.readFileSync(out, "utf8")).entries;
    const sorted = got.every((x, i) => i === 0 || got[i - 1].score > x.score || (got[i - 1].score === x.score && Date.parse(got[i - 1].achieved_at) <= Date.parse(x.achieved_at)));
    return (got.length === 10 && sorted && !got.some((x) => x.name === "x")) || show(got);
  });
}

console.log(`\n${pass} passed, ${fail} failed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
