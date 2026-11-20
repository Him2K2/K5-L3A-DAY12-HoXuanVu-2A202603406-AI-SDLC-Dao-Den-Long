// Build the three JSONL line types (contract E) from a Game instance.
// Coordinates are rounded to 3 decimals; everything is plain JSON-serialisable.

import { r3 } from "./vec.js";

export function snapshotLine(game) {
  return {
    type: "snapshot",
    tick: game.tick,
    sim_tick: game.tick, // Phase 1: sim_tick == tick
    state: game.state,
    time_left_s: r3(game.timeLeft),
    score: game.score,
    player: {
      pos: [r3(game.player.x), r3(game.player.y), r3(game.player.z)],
      flames: game.player.flames,
      carried: game.player.carried,
    },
    lanterns: game.lanterns.map((l) => ({
      id: l.id,
      pos: [r3(l.x), r3(l.y), r3(l.z)],
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: game.shades.map((s) => ({
      id: s.id,
      pos: [r3(s.x), r3(s.y), r3(s.z)],
      state: s.state,
    })),
    // Recommended in v1.0: full mote list with ids + positions.
    motes: game.motes.filter((m) => m.active).map((m) => ({
      id: m.id,
      pos: [r3(m.x), r3(0), r3(m.z)],
    })),
    motes_active: game.motesActive(),
  };
}

export function eventLine(tick, ev) {
  return { type: "event", tick, name: ev.name, data: ev.data };
}

export function endLine(game) {
  return { type: "end", ticks: game.tick, state: game.state, score: game.score };
}
