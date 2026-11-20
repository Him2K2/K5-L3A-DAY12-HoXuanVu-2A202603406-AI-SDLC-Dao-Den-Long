// Regenerate everything under evidence/ from scratch (reproducible).
// Run: node scripts/gen-evidence.js
import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const RUN = path.join(root, "src/headless/run.js");
const ev = path.join(root, "evidence");
fs.rmSync(ev, { recursive: true, force: true });
fs.mkdirSync(ev, { recursive: true });

const sc = (f) => path.join(root, "tests/scenarios", f);
const inp = (f) => path.join(root, "tests/inputs", f);
const log = [];

function run(label, args) {
  const out = path.join(ev, `${label}.jsonl`);
  execFileSync("node", [RUN, ...args, "--out", out], { stdio: "inherit" });
  const lines = fs.readFileSync(out, "utf8").trim().split("\n");
  const end = JSON.parse(lines.at(-1));
  const events = lines.map((l) => JSON.parse(l)).filter((x) => x.type === "event").map((x) => x.name);
  log.push(`${label}: ${lines.length} lines, end=${JSON.stringify(end)}, events=[${[...new Set(events)].join(", ")}]`);
  return out;
}

// Core-rule evidence.
run("deposit", ["--seed", "1", "--night", "1", "--scenario", sc("deposit.json"), "--inputs", inp("deposit.json"), "--ticks", "5", "--snapshot-every", "1"]);
run("pickup", ["--seed", "1", "--night", "1", "--scenario", sc("pickup.json"), "--ticks", "5", "--snapshot-every", "1"]);

// Pulse + hit need small ad-hoc input files.
const pulseIn = path.join(ev, "_pulse-inputs.json");
fs.writeFileSync(pulseIn, JSON.stringify({ frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] }, null, 2));
run("pulse", ["--seed", "1", "--night", "1", "--scenario", sc("pulse.json"), "--inputs", pulseIn, "--ticks", "5", "--snapshot-every", "1"]);
run("hit", ["--seed", "1", "--night", "1", "--scenario", sc("hit.json"), "--ticks", "5", "--snapshot-every", "1"]);

// Dawn (time out) => lost.
const dawnSc = path.join(ev, "_dawn-scenario.json");
fs.writeFileSync(dawnSc, JSON.stringify({ random_motes: false, random_shades: false, motes: [], shades: [], time_left_s: 0.1 }, null, 2));
run("dawn", ["--seed", "1", "--night", "1", "--scenario", dawnSc, "--ticks", "30", "--snapshot-every", "2"]);

// A full default night driven by the seed (motes + shade spawns), 60s of sim.
run("default-night", ["--seed", "42", "--night", "1", "--ticks", "3600", "--snapshot-every", "30"]);

// Determinism proof: two runs, identical bytes.
const a = run("determinism-run-a", ["--seed", "7", "--night", "1", "--ticks", "1800", "--snapshot-every", "20"]);
const b = run("determinism-run-b", ["--seed", "7", "--night", "1", "--ticks", "1800", "--snapshot-every", "20"]);
const identical = fs.readFileSync(a, "utf8") === fs.readFileSync(b, "utf8");
log.push(`determinism: run-a and run-b byte-identical = ${identical}`);
if (!identical) { console.error("DETERMINISM FAILED"); process.exit(1); }

fs.writeFileSync(path.join(ev, "SUMMARY.txt"),
  `Evidence generated ${new Date().toISOString()}\n` +
  `Reproduce: node scripts/gen-evidence.js\n\n` + log.join("\n") + "\n");
console.log("\n" + log.join("\n"));
