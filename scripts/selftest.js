// Self-test harness: determinism, core rules, and exit codes.
// Run: npm run selftest   (exit 0 = all pass)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const RUN = path.join(root, "src", "headless", "run.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ddl-"));
let pass = 0, fail = 0;

function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
}

function run(args) {
  try {
    const out = execFileSync("node", [RUN, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: e.stdout || "", err: e.stderr || "" };
  }
}
const readLines = (f) => fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));

// 1. Determinism: identical output across two runs of the default night.
{
  const a = path.join(tmp, "a.jsonl"), b = path.join(tmp, "b.jsonl");
  run(["--seed", "7", "--night", "1", "--ticks", "900", "--out", a, "--snapshot-every", "15"]);
  run(["--seed", "7", "--night", "1", "--ticks", "900", "--out", b, "--snapshot-every", "15"]);
  ok("determinism: same seed => identical bytes",
     fs.readFileSync(a, "utf8") === fs.readFileSync(b, "utf8"));
  // Different seed should differ (very high probability with random spawns).
  const c = path.join(tmp, "c.jsonl");
  run(["--seed", "999", "--night", "1", "--ticks", "900", "--out", c, "--snapshot-every", "15"]);
  ok("determinism: different seed => different output",
     fs.readFileSync(a, "utf8") !== fs.readFileSync(c, "utf8"));
}

// 2. Deposit lights a lantern and scores per_lantern.
{
  const out = path.join(tmp, "dep.jsonl");
  const r = run(["--seed", "1", "--night", "1",
    "--scenario", path.join(root, "tests/scenarios/deposit.json"),
    "--inputs", path.join(root, "tests/inputs/deposit.json"),
    "--ticks", "5", "--out", out, "--snapshot-every", "1"]);
  const lines = readLines(out);
  const lit = lines.find((l) => l.type === "event" && l.name === "lantern_lit");
  const end = lines.at(-1);
  ok("deposit: lantern_lit emitted at tick 1", lit && lit.tick === 1, JSON.stringify(lit));
  ok("deposit: score == per_lantern (100)", end.score === 100, `score=${end.score}`);
  ok("exit 0 on normal run", r.code === 0);
}

// 3. Pulse stuns a nearby shade and pushes it to the pulse_radius edge.
{
  const out = path.join(tmp, "pulse.jsonl");
  const inputs = path.join(tmp, "pulse-in.json");
  fs.writeFileSync(inputs, JSON.stringify({ frames: [
    { tick: 0, pulse: true }, { tick: 1, pulse: false },
  ]}));
  run(["--seed", "1", "--night", "1",
    "--scenario", path.join(root, "tests/scenarios/pulse.json"),
    "--inputs", inputs, "--ticks", "3", "--out", out, "--snapshot-every", "1"]);
  const lines = readLines(out);
  const pulse = lines.find((l) => l.type === "event" && l.name === "pulse");
  ok("pulse: event lists stunned S1", pulse && pulse.data.stunned_ids.includes("S1"), JSON.stringify(pulse));
  const snap1 = lines.find((l) => l.type === "snapshot" && l.tick === 1);
  const s1 = snap1.shades.find((s) => s.id === "S1");
  ok("pulse: shade state == stunned", s1 && s1.state === "stunned", JSON.stringify(s1));
  // Pushed from x=3 by pulse_push_m=3 => x≈6.
  ok("pulse: shade pushed outward (x≈6)", s1 && Math.abs(s1.pos[0] - 6) < 1e-6, JSON.stringify(s1));
}

// 4. Malformed inputs/scenario => exit code 2.
{
  const bad = path.join(tmp, "bad.json");
  fs.writeFileSync(bad, "{ this is not json ");
  const r1 = run(["--seed", "1", "--night", "1", "--inputs", bad, "--ticks", "1", "--out", path.join(tmp, "x.jsonl")]);
  ok("exit 2 on malformed inputs JSON", r1.code === 2, `code=${r1.code}`);

  const bad2 = path.join(tmp, "bad2.json");
  fs.writeFileSync(bad2, JSON.stringify({ frames: [{ tick: 5 }, { tick: 3 }] })); // not increasing
  const r2 = run(["--seed", "1", "--night", "1", "--inputs", bad2, "--ticks", "1", "--out", path.join(tmp, "y.jsonl")]);
  ok("exit 2 on non-increasing frame ticks", r2.code === 2, `code=${r2.code}`);

  const bad3 = path.join(tmp, "bad3.json");
  fs.writeFileSync(bad3, "[1,2,3]"); // scenario must be object
  const r3 = run(["--seed", "1", "--night", "1", "--scenario", bad3, "--ticks", "1", "--out", path.join(tmp, "z.jsonl")]);
  ok("exit 2 on non-object scenario", r3.code === 2, `code=${r3.code}`);
}

// 5. Win scenario: all 5 lanterns pre-filled to one-away, then deposit to win.
{
  const scen = path.join(tmp, "win.json");
  fs.writeFileSync(scen, JSON.stringify({
    player: { pos: [0, 0, 23], carried: 5, flames: 3 },
    random_motes: false, random_shades: false, motes: [], shades: [],
    lanterns: [
      { id: "L2", lit: true }, { id: "L3", lit: true },
      { id: "L4", lit: true }, { id: "L5", lit: true },
    ],
    time_left_s: 10,
  }));
  const inputs = path.join(tmp, "win-in.json");
  fs.writeFileSync(inputs, JSON.stringify({ frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }] }));
  const out = path.join(tmp, "win.jsonl");
  const r = run(["--seed", "1", "--night", "1", "--scenario", scen, "--inputs", inputs, "--ticks", "60", "--out", out]);
  const lines = readLines(out);
  const over = lines.find((l) => l.type === "event" && l.name === "game_over");
  const end = lines.at(-1);
  ok("win: game_over result=won reason=all_lit", over && over.data.result === "won" && over.data.reason === "all_lit", JSON.stringify(over));
  ok("win: end state == won", end.state === "won", JSON.stringify(end));
  ok("win: pre-lit lanterns scored no light points (only L1=100 + bonuses)", end.score >= 100, `score=${end.score}`);
  ok("win: run stops at the winning tick", r.code === 0 && end.ticks < 60, `ticks=${end.ticks}`);
}

// 6. Dawn => lost.
{
  const scen = path.join(tmp, "dawn.json");
  fs.writeFileSync(scen, JSON.stringify({ random_motes: false, random_shades: false, motes: [], shades: [], time_left_s: 0.05 }));
  const out = path.join(tmp, "dawn.jsonl");
  run(["--seed", "1", "--night", "1", "--scenario", scen, "--ticks", "100", "--out", out]);
  const lines = readLines(out);
  const over = lines.find((l) => l.type === "event" && l.name === "game_over");
  ok("dawn: game_over result=lost reason=dawn", over && over.data.result === "lost" && over.data.reason === "dawn", JSON.stringify(over));
}

console.log(`\n${pass} passed, ${fail} failed`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
