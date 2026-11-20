#!/usr/bin/env node
// Headless runner (Test Contract v1.0, sections B & E).
//
//   node src/headless/run.js --seed <int> --night 1 [--scenario f.json]
//        [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every <int=10>]
//
// Exit codes: 0 ok (incl. game over) | 2 malformed inputs/scenario | 1 other error.

import fs from "node:fs";
import { Game } from "../core/game.js";
import { InputTrack, BadInput } from "../core/inputs.js";
import { snapshotLine, eventLine, endLine } from "../core/snapshot.js";

function parseArgs(argv) {
  const a = {
    seed: 0, night: 1, scenario: null, inputs: null,
    ticks: 0, out: null, snapshotEvery: 10,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    switch (k) {
      case "--seed": a.seed = toInt(v, "--seed"); i++; break;
      case "--night": a.night = toInt(v, "--night"); i++; break;
      case "--scenario": a.scenario = v; i++; break;
      case "--inputs": a.inputs = v; i++; break;
      case "--ticks": a.ticks = toInt(v, "--ticks"); i++; break;
      case "--out": a.out = v; i++; break;
      case "--snapshot-every": a.snapshotEvery = toInt(v, "--snapshot-every"); i++; break;
      default: throw new UsageError(`unknown argument: ${k}`);
    }
  }
  if (a.out == null) throw new UsageError("--out is required");
  if (![1, 2, 3].includes(a.night)) throw new UsageError("--night must be 1, 2 or 3");
  if (a.ticks < 0) throw new UsageError("--ticks must be >= 0");
  if (a.snapshotEvery < 1) throw new UsageError("--snapshot-every must be >= 1");
  return a;
}

class UsageError extends Error {}
function toInt(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new UsageError(`${name} must be an integer`);
  return n;
}

function readJson(path, kind) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (e) {
    throw new UsageError(`cannot read ${kind} file: ${path}`); // missing file => usage (exit 1)
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new BadInput(`${kind} file is not valid JSON: ${path}`); // malformed => exit 2
  }
}

function main() {
  const a = parseArgs(process.argv.slice(2));

  let scenario = null;
  if (a.scenario) {
    scenario = readJson(a.scenario, "scenario");
    if (typeof scenario !== "object" || scenario === null || Array.isArray(scenario)) {
      throw new BadInput("scenario must be a JSON object");
    }
  }

  let track;
  const inputData = a.inputs ? readJson(a.inputs, "inputs") : null;
  track = new InputTrack(inputData); // throws BadInput on malformed frames

  const game = new Game({ seed: a.seed, night: a.night, scenario });

  const lines = [];
  const push = (obj) => lines.push(JSON.stringify(obj));

  // Snapshot of tick 0: state after scenario build, before any input.
  push(snapshotLine(game));
  push(eventLine(0, { name: "night_start", data: { night: a.night } }));

  for (let k = 0; k < a.ticks; k++) {
    const input = track.resolve(k);
    const events = game.step(input);
    for (const ev of events) push(eventLine(game.tick, ev)); // events in step k => tick k+1
    if (game.tick % a.snapshotEvery === 0) push(snapshotLine(game));
    if (game.state === "won" || game.state === "lost") break;
  }

  push(endLine(game)); // required final line

  fs.writeFileSync(a.out, lines.join("\n") + "\n");
}

try {
  main();
  process.exit(0);
} catch (e) {
  if (e instanceof BadInput) {
    process.stderr.write(`[inputs/scenario error] ${e.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`[error] ${e && e.message ? e.message : e}\n`);
  process.exit(1);
}
