// JSONL line builders (Contract v1.1, section E). Coordinates rounded to 3 decimals.
import { r3 } from "./vec.js";

const P = (x, y, z) => [r3(x), r3(y), r3(z)];
const S = (ticks) => r3(ticks / 60);

export function snapshotLine(g) {
  const p = g.player;
  return {
    type: "snapshot",
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.stateLabel,
    time_left_s: r3(g.timeLeft),
    score: g.score,
    wind: { active: g.wind.active, dir_deg: r3(g.wind.active ? g.wind.dirDeg : 0) },
    player: {
      pos: P(p.x, p.y, p.z),
      vel: P(p.vx, p.vy, p.vz),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      invuln: S(p.invuln),
      dash_cd_s: S(p.dashCd),
      pulse_cd_s: S(p.pulseCd),
      charm_s: S(p.charm),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: P(l.x, l.y, l.z), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: P(s.x, s.y, s.z), state: s.state })),
    motes: g.motes.map((m) => ({
      id: m.id, pos: P(m.x, m.y, m.z), kind: m.kind, ttl_s: m.ttl == null ? null : S(m.ttl),
    })),
    motes_active: g.motes.length,
    drifters: g.drifters.map((d) => ({ id: d.id, pos: P(d.x, d.y, d.z), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: P(c.x, c.y, c.z), available: c.available, respawn_s: S(c.respawn) })),
  };
}

export function eventLine(tick, ev) {
  return { type: "event", tick, name: ev.name, data: ev.data };
}

export function endLine(g) {
  return { type: "end", ticks: g.tick, state: g.stateLabel, score: g.score };
}
