// Deterministic simulation for "Đảo Đèn Lồng" — TICKET-02 / Contract v1.1.
// One Game = one night. The web build and the headless runner drive the SAME class.
//
// step() follows the mandatory per-tick order from TICKET-02:
//   1 input (pause first)  2 counters  3 move player (+fall check)  4 pickups
//   5 lantern interact  6 safe zones  7 pulse  8 move shades & drifters
//   9 contacts (drifters steal, then shades hit, by ascending id)
//  10 scheduled spawns  11 win/lose  (12 snapshot is done by the caller)

import { DT, TICK_HZ, R, cloneTuning } from "./config.js";
import { getMap } from "./maps.js";
import { makeRNG } from "./prng.js";
import { clampLen } from "./vec.js";

const NONE = -Infinity;
const EPS = 1e-9;
const dec = (v) => (v > 0 ? v - 1 : 0);
const dXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function splitId(id) {
  const m = /^(\D*)(\d+)$/.exec(id);
  return m ? [m[1], Number(m[2])] : [id, -1];
}
export function idCmp(a, b) {
  const [pa, na] = splitId(a.id), [pb, nb] = splitId(b.id);
  if (pa !== pb) return pa < pb ? -1 : 1;
  if (na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function hashStr(s) { // FNV-1a, for per-entity PRNG streams
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const SHADE_STATES = ["spawning", "wander", "chase", "recoil", "stunned"];
const DRIFTER_STATES = ["idle", "chase", "flee", "removed"];

export class Game {
  constructor({ seed = 0, night = 1, tuning, scenario } = {}) {
    this.seed = seed >>> 0;
    this.rng = makeRNG(this.seed);
    this.t = cloneTuning(tuning);
    this.night = night;
    this.map = getMap(night);

    this.tick = 0; // all ticks, incl. paused ones
    this.simTick = 0; // gameplay ticks only
    this.state = "playing"; // playing | won | lost
    this.paused = false;
    this.score = 0;
    this.pending = [];
    this.nShade = 0; this.nMote = 0; this.nDrifter = 0;

    const sc = scenario || {};
    this.autoMotes = sc.random_motes !== false;
    this.autoShades = sc.random_shades !== false;
    this.autoDrifters = sc.random_drifters !== false && this.map.drifters;
    this.windEnabled = typeof sc.wind_enabled === "boolean" ? sc.wind_enabled : this.map.wind;
    this.startTimeLeft = typeof sc.time_left_s === "number" ? sc.time_left_s : this.t[this.map.durationKey];
    this.shadeSpeed = this.map.shadeSpeed ?? this.t.shade_speed;
    this.wind = { active: false, dirDeg: 0, left: 0 };

    this._buildPlayer(sc.player);
    this._buildLanterns(sc.lanterns);
    this._buildMotes(sc.motes);
    this._buildShades(sc.shades);
    this._buildDrifters(sc.drifters);
    this._buildCharms(sc.charms);
  }

  // ------------------------------------------------------------ scenario build
  // (no events, no score)

  ground(x, z) { return this.map.ground(x, z); }

  _buildPlayer(p = {}) {
    const pos = Array.isArray(p.pos) ? p.pos : this.map.start;
    const g = this.ground(pos[0], pos[2]);
    this.player = {
      x: pos[0], y: pos[1], z: pos[2],
      vx: 0, vy: 0, vz: 0,
      grounded: g !== NONE && Math.abs(pos[1] - g) <= 0.01,
      facing: [0, 1], // +Z
      flames: typeof p.flames === "number" ? p.flames : this.t.flames,
      carried: typeof p.carried === "number" ? p.carried : 0,
      invuln: p.invuln_ticks | 0,
      dashCd: p.dash_cd_ticks | 0,
      pulseCd: p.pulse_cd_ticks | 0,
      charm: p.charm_ticks | 0,
      dashLeft: 0, dashDir: [0, 1],
      launched: false, launchV: [0, 0],
      fallen: false, fallWait: 0,
    };
  }

  _buildLanterns(override) {
    this.lanterns = this.map.lanterns.map((l) => ({
      id: l.id, x: l.pos[0], y: l.pos[1], z: l.pos[2], deposited: 0, lit: false,
    }));
    if (!Array.isArray(override)) return;
    for (const o of override) {
      const l = this.lanterns.find((q) => q.id === o.id);
      if (!l) continue;
      if (Array.isArray(o.pos)) { l.x = o.pos[0]; l.y = o.pos[1] ?? l.y; l.z = o.pos[2]; }
      if (typeof o.deposited === "number") l.deposited = o.deposited;
      if (o.lit === true) { l.lit = true; l.deposited = Math.max(l.deposited, this.t.lantern_cost); }
      if (o.lit === false) l.lit = false;
    }
  }

  _addMote(x, y, z, kind = "random", ttl = null, point = -1) {
    const m = { id: `M${++this.nMote}`, x, y, z, kind, ttl, point };
    this.motes.push(m);
    return m;
  }

  _buildMotes(list) {
    this.motes = [];
    if (Array.isArray(list)) {
      for (const e of list) {
        if (Array.isArray(e)) this._addMote(e[0], e[1] || 0, e[2]);
        else if (e && Array.isArray(e.pos)) {
          const kind = e.kind === "dropped" ? "dropped" : "random";
          const ttl = kind === "dropped" ? (e.ttl_ticks ?? R.DROP_TTL_T) : null;
          this._addMote(e.pos[0], e.pos[1] || 0, e.pos[2], kind, ttl);
        }
      }
      return;
    }
    if (!this.autoMotes) return;
    // 20 distinct spawn points, chosen by seeded Fisher-Yates.
    const idx = this.map.motePoints.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (const i of idx.slice(0, R.MOTE_START)) {
      const [x, y, z] = this.map.motePoints[i];
      this._addMote(x, y, z, "random", null, i);
    }
  }

  _makeShade(id, x, y, z, state, t) {
    return {
      id, x, y, z, state, t,
      home: [x, z], target: null, wrng: makeRNG(this.seed ^ hashStr(id)),
      pushDir: [1, 0], pushLeft: 0, eject: null,
    };
  }

  _buildShades(list) {
    this.shades = [];
    if (!Array.isArray(list)) return;
    for (const s of list) {
      if (s && typeof s.id === "string") {
        const [, n] = splitId(s.id);
        if (n > this.nShade) this.nShade = n;
      }
    }
    for (const s of list) {
      const id = typeof s.id === "string" ? s.id : `S${++this.nShade}`;
      const pos = Array.isArray(s.pos) ? s.pos : [0, 0, 0];
      let state = SHADE_STATES.includes(s.state) ? s.state : null;
      let t = 0;
      if (state) {
        const def = { spawning: R.SHADE_SPAWN_T, stunned: R.STUN_T, recoil: R.RECOIL_T }[state] || 0;
        t = typeof s.state_ticks_left === "number" ? s.state_ticks_left : def;
      } else {
        const d = dXZ(pos[0], pos[2], this.player.x, this.player.z);
        state = d <= R.SHADE_DETECT ? "chase" : "wander";
      }
      this.shades.push(this._makeShade(id, pos[0], pos[1] ?? 0, pos[2], state, t));
    }
    this.shades.sort(idCmp);
  }

  _makeDrifter(id, x, y, z, state = "idle", stolen = 0, t = 0) {
    return {
      id, x, y, z, state, stolen, t, hasStolen: stolen > 0,
      home: [x, z], target: null, wrng: makeRNG(this.seed ^ hashStr(id)),
    };
  }

  _buildDrifters(list) {
    this.drifters = [];
    if (!Array.isArray(list)) return;
    for (const d of list) {
      if (d && typeof d.id === "string") {
        const [, n] = splitId(d.id);
        if (n > this.nDrifter) this.nDrifter = n;
      }
    }
    for (const d of list) {
      const id = typeof d.id === "string" ? d.id : `D${++this.nDrifter}`;
      const pos = Array.isArray(d.pos) ? d.pos : [0, 0, 0];
      const state = DRIFTER_STATES.includes(d.state) ? d.state : "idle";
      const def = state === "flee" ? R.DRIFTER_FLEE_T : 0;
      const t = typeof d.state_ticks_left === "number" ? d.state_ticks_left : def;
      this.drifters.push(this._makeDrifter(id, pos[0], pos[1] ?? 0, pos[2], state, d.stolen | 0, t));
    }
    this.drifters.sort(idCmp);
  }

  _buildCharms(list) {
    const src = Array.isArray(list) ? list : this.map.charms;
    this.charms = src.map((c) => {
      const base = this.map.charms.find((m) => m.id === c.id);
      const pos = Array.isArray(c.pos) ? c.pos : base ? base.pos : [0, 0, 0];
      const available = c.available !== false;
      return {
        id: c.id, x: pos[0], y: pos[1] || 0, z: pos[2], available,
        respawn: available ? 0 : (c.respawn_ticks ?? R.CHARM_RESPAWN_T),
      };
    });
  }

  // ------------------------------------------------------------ helpers

  emit(name, data) { this.pending.push({ name, data }); }

  get timeLeft() { return this.startTimeLeft - this.simTick / TICK_HZ; }
  get stateLabel() { return this.paused && this.state === "playing" ? "paused" : this.state; }
  get windWarning() {
    if (!this.windEnabled || this.wind.active) return false;
    const into = this.simTick % R.WIND_EVERY;
    return into >= R.WIND_EVERY - R.WIND_WARN;
  }

  _inSafeZone(x, z) {
    for (const l of this.lanterns) {
      if (l.lit && dXZ(x, z, l.x, l.z) < this.t.safe_radius - EPS) return l;
    }
    return null;
  }

  _hover(e, h) {
    const g = this.ground(e.x, e.z);
    if (g !== NONE) e.y = g + h;
  }

  // Shades float over tiers, but are blocked by the sea, the tower and lit safe zones.
  // Returns false when the move was blocked or clamped (used to stop push-backs).
  _moveShade(sh, dx, dz) {
    let nx = sh.x + dx, nz = sh.z + dz;
    if (this.map.shadeBlocked(nx, nz)) return false;
    let clean = true;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const dNew = dXZ(nx, nz, l.x, l.z);
      const dOld = dXZ(sh.x, sh.z, l.x, l.z);
      if (dNew < this.t.safe_radius - EPS && dOld >= this.t.safe_radius - EPS) {
        const len = dNew || 1;
        const ux = dNew ? (nx - l.x) / len : 1, uz = dNew ? (nz - l.z) / len : 0;
        nx = l.x + ux * this.t.safe_radius;
        nz = l.z + uz * this.t.safe_radius;
        clean = false;
      }
    }
    if (this.map.shadeBlocked(nx, nz)) return false;
    sh.x = nx; sh.z = nz;
    this._hover(sh, R.SHADE_HOVER);
    return clean;
  }

  _engageState(sh) {
    const d = dXZ(sh.x, sh.z, this.player.x, this.player.z);
    if (d <= R.SHADE_GIVEUP) return "chase";
    sh.home = [sh.x, sh.z]; sh.target = null;
    return "wander";
  }

  _dropMotes(n, cx, cz, fallbackY) {
    if (n <= 0) return;
    const base = this.rng.range(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = base + (i * 2 * Math.PI) / n;
      const r = this.rng.range(R.DROP_R_MIN, R.DROP_R_MAX);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const g = this.ground(x, z);
      this._addMote(x, g === NONE ? fallbackY : g, z, "dropped", R.DROP_TTL_T);
    }
  }

  // ------------------------------------------------------------ the tick

  /**
   * input: { move:[x,z], camYaw, jump, interact, pulse, dash, pause }
   * Buttons are TRUE only on the tick their press begins (false -> true).
   */
  step(input) {
    this.pending = [];
    if (this.state !== "playing") return this.pending;
    this.tick += 1;

    // 1. input — pause first
    if (input.pause) {
      this.paused = !this.paused;
      this.emit(this.paused ? "paused" : "resumed", {});
      if (this.paused) return this.pending;
    }
    if (this.paused) return this.pending;
    const st = ++this.simTick;

    this._counters(st);
    this._movePlayer(input);
    this._pickups();
    if (input.interact) this._interact();
    this._safeZones();
    if (input.pulse) this._pulse();
    this._moveShades();
    this._moveDrifters();
    this._contacts();
    this._spawns(st);
    this._judge();
    return this.pending;
  }

  // 2. counters
  _counters(st) {
    const p = this.player;
    p.invuln = dec(p.invuln);
    p.dashCd = dec(p.dashCd);
    p.pulseCd = dec(p.pulseCd);
    p.charm = dec(p.charm);
    p.dashLeft = dec(p.dashLeft);
    p.fallWait = dec(p.fallWait);

    for (const sh of this.shades) {
      if (sh.state === "spawning" || sh.state === "stunned" || sh.state === "recoil") {
        sh.t = dec(sh.t);
        if (sh.t === 0) sh.state = this._engageState(sh);
      }
    }
    this.motes = this.motes.filter((m) => {
      if (m.kind !== "dropped") return true;
      m.ttl = dec(m.ttl);
      return m.ttl > 0;
    });
    for (const c of this.charms) {
      if (!c.available) { c.respawn = dec(c.respawn); if (c.respawn === 0) c.available = true; }
    }
    for (const d of this.drifters) {
      if (d.state === "flee") { d.t = dec(d.t); if (d.t === 0) d.state = "removed"; }
    }
    if (this.windEnabled) {
      if (this.wind.active) { this.wind.left = dec(this.wind.left); if (this.wind.left === 0) this.wind.active = false; }
      if (st % R.WIND_EVERY === 0) {
        this.wind = { active: true, left: R.WIND_LEN, dirDeg: this.rng.range(0, 360) };
      }
    }
  }

  // 3. move player, then fall check
  _movePlayer(input) {
    const p = this.player, t = this.t;
    if (p.fallen) {
      p.vx = p.vy = p.vz = 0;
      if (p.fallWait > 0) return;
      const s = this.map.start; // respawn
      p.x = s[0]; p.y = s[1]; p.z = s[2];
      p.grounded = true; p.launched = false; p.dashLeft = 0;
      p.facing = [0, 1]; p.invuln = R.INVULN_T; p.fallen = false;
      return;
    }

    const [mx, mz] = clampLen(input.move?.[0] || 0, input.move?.[1] || 0, 1);
    const th = ((input.camYaw || 0) * Math.PI) / 180;
    const c = Math.cos(th), s = Math.sin(th);
    const dx = mx * c + mz * s, dz = -mx * s + mz * c; // contract C
    const mlen = Math.hypot(dx, dz);
    if (mlen > EPS) p.facing = [dx / mlen, dz / mlen];

    if (input.dash && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashLeft = R.DASH_T;
      p.dashDir = mlen > EPS ? [dx / mlen, dz / mlen] : [...p.facing];
      if (p.charm === 0) p.dashCd = R.DASH_CD_T;
      this.emit("dash", {});
    }
    if (input.jump && p.grounded) { p.vy = R.JUMP_SPEED; p.grounded = false; }

    let hx, hz;
    if (p.dashLeft > 0) { hx = p.dashDir[0] * t.dash_speed; hz = p.dashDir[1] * t.dash_speed; }
    else if (p.launched) { [hx, hz] = p.launchV; }
    else {
      const speed = p.charm > 0 ? R.CHARM_SPEED : t.player_speed;
      hx = dx * speed; hz = dz * speed;
    }
    if (this.wind.active) {
      const w = (this.wind.dirDeg * Math.PI) / 180;
      hx += Math.cos(w) * R.WIND_SPEED; hz += Math.sin(w) * R.WIND_SPEED;
    }

    // Horizontal move with terrain walls (axis-separated slide).
    const ox = p.x, oz = p.z;
    const limit = p.y + (p.grounded ? R.STEP_UP : 0);
    const nx = p.x + hx * DT, nz = p.z + hz * DT;
    if (this.ground(nx, nz) <= limit) { p.x = nx; p.z = nz; }
    else if (this.ground(nx, p.z) <= limit) p.x = nx;
    else if (this.ground(p.x, nz) <= limit) p.z = nz;
    p.vx = (p.x - ox) / DT; p.vz = (p.z - oz) / DT;

    // Vertical.
    if (p.dashLeft > 0 && !p.grounded) p.vy = 0; // air dash keeps altitude
    else if (!p.grounded) { p.vy -= R.GRAVITY * DT; p.y += p.vy * DT; }
    const g = this.ground(p.x, p.z);
    if (!p.grounded) {
      if (p.vy <= 0 && p.y <= g) { p.y = g; p.vy = 0; p.grounded = true; p.launched = false; }
    } else if (g === NONE || g < p.y - R.STEP_UP) {
      p.grounded = false; // walked off a ledge / the island
    } else {
      p.y = g;
    }

    // Jump pads (launch takes effect next tick).
    if (p.grounded) {
      for (const pad of this.map.pads) {
        if (dXZ(p.x, p.z, pad.pos[0], pad.pos[2]) <= pad.r && Math.abs(p.y - pad.pos[1]) <= R.STEP_UP) {
          let ux, uz;
          if (pad.dir) [ux, uz] = pad.dir;
          else {
            const ddx = pad.target[0] - pad.pos[0], ddz = pad.target[1] - pad.pos[2];
            const l = Math.hypot(ddx, ddz); ux = ddx / l; uz = ddz / l;
          }
          p.launchV = [ux * pad.vh, uz * pad.vh];
          p.vy = pad.vy; p.grounded = false; p.launched = true;
          break;
        }
      }
    }

    // Fall off the island: exactly once, ignores invulnerability.
    if (p.y < R.FALL_Y) {
      p.flames -= 1;
      const lost = p.carried;
      p.carried = 0;
      p.fallen = true; p.fallWait = R.FALL_WAIT_T;
      p.vx = p.vy = p.vz = 0; p.dashLeft = 0; p.launched = false;
      this.emit("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost });
    }
  }

  // 4. pickups
  _pickups() {
    const p = this.player, t = this.t;
    if (p.fallen) return;
    const keep = [];
    for (const m of this.motes) {
      if (p.carried < t.carry_capacity &&
          dXZ(p.x, p.z, m.x, m.z) <= t.pickup_radius && Math.abs(p.y - m.y) <= R.PICKUP_DY) {
        p.carried += 1;
        this.emit("mote_picked", { carried: p.carried });
      } else keep.push(m);
    }
    this.motes = keep;
    for (const c of this.charms) {
      if (c.available && dXZ(p.x, p.z, c.x, c.z) <= t.pickup_radius && Math.abs(p.y - c.y) <= R.PICKUP_DY) {
        c.available = false; c.respawn = R.CHARM_RESPAWN_T;
        p.charm = R.CHARM_T;
        this.emit("charm_picked", { charm_id: c.id, charm_ticks: R.CHARM_T });
      }
    }
  }

  // 5. lantern interaction
  _interact() {
    const p = this.player, t = this.t;
    if (p.fallen || p.carried <= 0) return;
    let best = null, bestD = Infinity;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = dXZ(p.x, p.z, l.x, l.z);
      if (d > t.interact_radius) continue;
      if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && idCmp(l, best) < 0)) { best = l; bestD = d; }
    }
    if (!best) return;
    const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    best.deposited += amount;
    this.score += t.score.per_mote * amount;
    this.emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
    if (best.deposited >= t.lantern_cost) {
      best.lit = true;
      this.score += t.score.per_lantern;
      this.emit("lantern_lit", { lantern_id: best.id });
    }
  }

  // 6. safe zones: shades inside a lit lantern's radius get pushed to its edge within 30 ticks
  _safeZones() {
    const safe = this.t.safe_radius;
    for (const sh of this.shades) {
      if (!sh.eject) {
        const l = this._inSafeZone(sh.x, sh.z);
        if (l) sh.eject = { l, left: R.SAFE_EJECT_T };
      }
      if (!sh.eject) continue;
      const { l } = sh.eject;
      const d = dXZ(sh.x, sh.z, l.x, l.z);
      const need = safe - d;
      if (need <= EPS) { sh.eject = null; continue; }
      const step = need / sh.eject.left;
      const ux = d > EPS ? (sh.x - l.x) / d : 1, uz = d > EPS ? (sh.z - l.z) / d : 0;
      sh.x += ux * step; sh.z += uz * step;
      this._hover(sh, R.SHADE_HOVER);
      sh.eject.left -= 1;
      if (sh.eject.left <= 0) sh.eject = null;
    }
  }

  // 7. pulse
  _pulse() {
    const p = this.player, t = this.t;
    if (p.fallen || p.pulseCd > 0 || p.carried < t.pulse_cost) return;
    p.carried -= t.pulse_cost;
    p.pulseCd = R.PULSE_CD_T;
    const cx = p.x, cy = p.y + R.PULSE_CENTER_DY, cz = p.z;
    const stunned = [];
    for (const sh of this.shades) {
      if (Math.hypot(sh.x - cx, sh.y - cy, sh.z - cz) > t.pulse_radius) continue;
      const hx = sh.x - p.x, hz = sh.z - p.z, l = Math.hypot(hx, hz);
      sh.pushDir = l > EPS ? [hx / l, hz / l] : [1, 0];
      sh.pushLeft = R.PUSH_T;
      sh.state = "stunned"; sh.t = R.STUN_T;
      stunned.push(sh.id);
    }
    this.score += t.score.per_stun * stunned.length;
    this.emit("pulse", { stunned_ids: stunned });
    for (const d of this.drifters) {
      if (d.state === "removed") continue;
      if (Math.hypot(d.x - cx, d.y - cy, d.z - cz) > t.pulse_radius) continue;
      if (d.state === "chase") { d.state = "flee"; d.t = R.DRIFTER_FLEE_T; d.hasStolen = true; }
      else if (d.state === "flee" && d.stolen > 0) {
        const amount = d.stolen;
        const g = this.ground(d.x, d.z);
        for (let i = 0; i < amount; i++) this._addMote(d.x, g === NONE ? p.y : g, d.z, "dropped", R.DROP_TTL_T);
        d.stolen = 0; d.t = R.DRIFTER_DROP_VANISH_T;
        this.emit("drifter_drop", { drifter_id: d.id, amount });
      }
    }
  }

  // 8a. shades
  _moveShades() {
    const p = this.player;
    for (const sh of this.shades) {
      if (sh.eject) continue;
      const d = dXZ(sh.x, sh.z, p.x, p.z);
      if (sh.state === "chase" && d > R.SHADE_GIVEUP) { sh.state = "wander"; sh.home = [sh.x, sh.z]; sh.target = null; }
      else if (sh.state === "wander" && d <= R.SHADE_DETECT) sh.state = "chase";

      if (sh.state === "stunned") {
        if (sh.pushLeft > 0) {
          const step = this.t.pulse_push_m / R.PUSH_T;
          const ok = this._moveShade(sh, sh.pushDir[0] * step, sh.pushDir[1] * step);
          sh.pushLeft = ok ? sh.pushLeft - 1 : 0;
        }
      } else if (sh.state === "recoil") {
        this._recoilStep(sh);
      } else if (sh.state === "chase") {
        if (d > EPS) {
          const step = Math.min(this.shadeSpeed * DT, d);
          this._moveShade(sh, ((p.x - sh.x) / d) * step, ((p.z - sh.z) / d) * step);
        }
      } else if (sh.state === "wander") {
        this._wanderStep(sh, R.WANDER_SPEED, true);
      }
    }
  }

  _recoilStep(sh) {
    const p = this.player;
    const hx = sh.x - p.x, hz = sh.z - p.z, l = Math.hypot(hx, hz);
    const ux = l > EPS ? hx / l : 1, uz = l > EPS ? hz / l : 0;
    const step = R.RECOIL_M / R.RECOIL_T;
    this._moveShade(sh, ux * step, uz * step);
  }

  _wanderStep(e, speed, isShade) {
    if (!e.target || dXZ(e.x, e.z, e.target[0], e.target[1]) < 0.3) {
      const a = e.wrng.next() * Math.PI * 2, r = Math.sqrt(e.wrng.next()) * R.WANDER_RADIUS;
      e.target = [e.home[0] + Math.cos(a) * r, e.home[1] + Math.sin(a) * r];
    }
    const d = dXZ(e.x, e.z, e.target[0], e.target[1]);
    if (d <= EPS) return;
    const step = Math.min(speed * DT, d);
    const mx = ((e.target[0] - e.x) / d) * step, mz = ((e.target[1] - e.z) / d) * step;
    if (isShade) { if (!this._moveShade(e, mx, mz)) e.target = null; }
    else { e.x += mx; e.z += mz; this._hover(e, R.DRIFTER_HOVER); }
  }

  // 8b. drifters (fly freely: no walls, no safe zones)
  _moveDrifters() {
    const p = this.player;
    for (const d of this.drifters) {
      if (d.state === "removed") continue;
      const dist = dXZ(d.x, d.z, p.x, p.z);
      const lure = !p.fallen && p.carried >= R.DRIFTER_CHASE_CARRY && dist <= R.DRIFTER_CHASE_DIST;
      if (d.state === "idle" && lure && !d.hasStolen) d.state = "chase";
      else if (d.state === "chase" && !lure) { d.state = "idle"; d.home = [d.x, d.z]; d.target = null; }

      if (d.state === "chase" && dist > EPS) {
        const step = Math.min(R.DRIFTER_SPEED * DT, dist);
        d.x += ((p.x - d.x) / dist) * step; d.z += ((p.z - d.z) / dist) * step;
        this._hover(d, R.DRIFTER_HOVER);
      } else if (d.state === "flee") {
        const ux = dist > EPS ? (d.x - p.x) / dist : 1, uz = dist > EPS ? (d.z - p.z) / dist : 0;
        d.x += ux * R.DRIFTER_SPEED * DT; d.z += uz * R.DRIFTER_SPEED * DT;
        this._hover(d, R.DRIFTER_HOVER);
      } else if (d.state === "idle") {
        this._wanderStep(d, R.DRIFTER_IDLE_SPEED, false);
      }
    }
  }

  // 9. contacts — drifters steal first, then at most one shade hit (ascending id)
  _contacts() {
    const p = this.player, t = this.t;
    if (p.fallen) return;
    for (const d of this.drifters) {
      if ((d.state !== "idle" && d.state !== "chase") || d.hasStolen || p.carried <= 0) continue;
      if (dXZ(d.x, d.z, p.x, p.z) > R.DRIFTER_TOUCH) continue;
      const amount = Math.min(R.DRIFTER_STEAL, p.carried);
      p.carried -= amount;
      d.stolen = amount; d.hasStolen = true; d.state = "flee"; d.t = R.DRIFTER_FLEE_T;
      this.emit("drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln > 0) return; // touching an invulnerable Mây does nothing
    for (const sh of this.shades) {
      if ((sh.state !== "chase" && sh.state !== "wander") || sh.eject) continue;
      if (dXZ(sh.x, sh.z, p.x, p.z) > t.shade_hit_radius || Math.abs(p.y - sh.y) > R.HIT_DY) continue;
      p.flames -= 1;
      const dropped = Math.floor(p.carried * t.hit_drop_ratio);
      p.carried -= dropped;
      this._dropMotes(dropped, p.x, p.z, p.y);
      p.invuln = R.INVULN_T;
      this.emit("player_hit", { by: "shade", flames: p.flames, dropped });
      sh.state = "recoil"; sh.t = R.RECOIL_T;
      this._recoilStep(sh); // first of 60 recoil steps happens on the hit tick
      break;
    }
  }

  // 10. scheduled spawns (new entities interact from the next tick)
  _spawns(st) {
    const map = this.map, p = this.player;
    if (this.autoMotes && st % R.MOTE_SPAWN_EVERY === 0 && this.motes.length < R.MOTE_CAP) {
      const free = [];
      map.motePoints.forEach((_, i) => { if (!this.motes.some((m) => m.point === i)) free.push(i); });
      if (free.length) {
        const i = free[Math.floor(this.rng.next() * free.length)];
        const [x, y, z] = map.motePoints[i];
        this._addMote(x, y, z, "random", null, i);
      }
    }
    if (this.autoShades) {
      let n = 0;
      if (st === R.SHADE_FIRST_SPAWN) n = 2;
      else if (st > R.SHADE_FIRST_SPAWN && (st - R.SHADE_FIRST_SPAWN) % map.shadeEvery === 0) n = 1;
      const used = new Set();
      for (let k = 0; k < n && this.shades.length < map.shadeMax; k++) {
        const valid = [];
        map.shadePoints.forEach((q, i) => {
          if (used.has(i)) return;
          if (dXZ(q[0], q[2], p.x, p.z) < R.SHADE_MIN_PLAYER_DIST) return;
          if (this._inSafeZone(q[0], q[2])) return;
          valid.push(i);
        });
        if (!valid.length) break; // skip this turn
        const i = valid[Math.floor(this.rng.next() * valid.length)];
        used.add(i);
        const q = map.shadePoints[i];
        const g = this.ground(q[0], q[2]);
        const id = `S${++this.nShade}`;
        this.shades.push(this._makeShade(id, q[0], (g === NONE ? 0 : g) + R.SHADE_HOVER, q[2], "spawning", R.SHADE_SPAWN_T));
        this.emit("shade_spawned", { id });
      }
    }
    if (this.autoDrifters && st % R.DRIFTER_EVERY === 0) {
      const alive = this.drifters.filter((d) => d.state !== "removed").length;
      if (alive < R.DRIFTER_MAX) {
        const q = map.shadePoints[Math.floor(this.rng.next() * map.shadePoints.length)];
        const g = this.ground(q[0], q[2]);
        this.drifters.push(this._makeDrifter(`D${++this.nDrifter}`, q[0], (g === NONE ? 0 : g) + R.DRIFTER_HOVER, q[2]));
      }
    }
  }

  // 11. win / lose
  _judge() {
    const p = this.player;
    if (p.flames <= 0) return this._gameOver("lost", "no_flames");
    if (this.lanterns.every((l) => l.lit)) return this._gameOver("won", "all_lit");
    if (this.timeLeft <= EPS) return this._gameOver("lost", "dawn");
  }

  _gameOver(result, reason) {
    this.state = result;
    if (result === "won") {
      const secs = Math.floor(Math.max(0, this.timeLeft) + 1e-6);
      this.score += this.t.score.per_second_left * secs + this.t.score.per_flame_left * this.player.flames;
    }
    this.emit("game_over", { result, reason });
  }
}
