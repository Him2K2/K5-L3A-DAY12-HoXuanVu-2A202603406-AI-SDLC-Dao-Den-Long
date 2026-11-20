// Deterministic simulation for "Dao Den Long" - Night 1.
// One Game instance = one authoritative sim. Rendering (web) and the headless
// runner both drive the SAME class, so what you see equals what gets graded.
//
// Contract conventions honoured here:
//  - 60 fixed ticks/second (DT = 1/60); metres; Y up; ground at Y=0.
//  - player.pos = feet, shade.pos = centre, lantern.pos = post base, mote = ground point.
//  - distances measured in the XZ plane; "within radius r" means distance <= r.
//  - building a scenario emits NO events and scores NO points.

import {
  DT, TICK_HZ, ISLAND_RADIUS, LANTERN_IDS, LANTERN_POSITIONS,
  JUMP_SPEED, GRAVITY, MOTE_SCATTER_COUNT, MOTE_MIN_RADIUS,
  SHADE_SPAWN_INTERVAL_S, SHADE_MAX, SHADE_SPAWN_RING,
  cloneTuning,
} from "./config.js";
import { makeRNG } from "./prng.js";
import { distXZ, clampLen } from "./vec.js";

export class Game {
  /**
   * @param {object} opts
   * @param {number} opts.seed
   * @param {object} [opts.tuning]   - overrides DEFAULT_TUNING
   * @param {object} [opts.scenario] - headless scenario (see contract D)
   */
  constructor(opts = {}) {
    this.seed = (opts.seed >>> 0) || 0;
    this.rng = makeRNG(this.seed);
    this.t = cloneTuning(opts.tuning);

    this.tick = 0; // gameplay steps executed so far (== sim_tick in Phase 1)
    this.state = "playing"; // "playing" | "won" | "lost"
    this.score = 0;
    this.pending = []; // events produced during the current step
    this.autoShadeN = 0; // counter for auto-generated shade ids

    const sc = opts.scenario || {};
    this.autoMotes = sc.random_motes !== false;
    this.autoShades = sc.random_shades !== false;

    this.startTimeLeft =
      typeof sc.time_left_s === "number" ? sc.time_left_s : this.t.night1_duration_s;

    this._buildPlayer(sc.player);
    this._buildLanterns(sc.lanterns);
    this._buildMotes(sc.motes);
    this._buildShades(sc.shades);

    // Auto-spawn timer only matters when random_shades is enabled.
    this.shadeSpawnTimer = SHADE_SPAWN_INTERVAL_S;
  }

  // ---- scenario construction (no events, no score) ----

  _buildPlayer(p = {}) {
    this.player = {
      x: 0, y: 0, z: 0,
      vy: 0,
      grounded: true,
      flames: typeof p.flames === "number" ? p.flames : this.t.flames,
      carried: typeof p.carried === "number" ? p.carried : 0,
      invuln: 0,
    };
    if (Array.isArray(p.pos)) {
      this.player.x = p.pos[0];
      this.player.y = p.pos[1];
      this.player.z = p.pos[2];
      this.player.grounded = this.player.y <= 0;
    }
    this.pulseCooldown = 0;
  }

  _buildLanterns(override) {
    // Start from the fixed Night-1 layout, then apply id-keyed overrides.
    this.lanterns = LANTERN_IDS.map((id) => ({
      id,
      x: LANTERN_POSITIONS[id][0],
      y: 0,
      z: LANTERN_POSITIONS[id][2],
      deposited: 0,
      lit: false,
    }));
    if (Array.isArray(override)) {
      for (const o of override) {
        const lan = this.lanterns.find((l) => l.id === o.id);
        if (!lan) continue;
        if (Array.isArray(o.pos)) { lan.x = o.pos[0]; lan.z = o.pos[2]; }
        if (typeof o.deposited === "number") lan.deposited = o.deposited;
        if (o.lit === true) { lan.lit = true; lan.deposited = Math.max(lan.deposited, this.t.lantern_cost); }
      }
    }
  }

  _buildMotes(override) {
    this.motes = [];
    let n = 0;
    const add = (x, z) => { this.motes.push({ id: `M${++n}`, x, z, active: true }); };
    if (Array.isArray(override)) {
      // Explicit list REPLACES the initial set (empty array = no motes).
      for (const m of override) add(m[0], m[2]);
    } else if (this.autoMotes) {
      // Scatter deterministically from the seed.
      for (let i = 0; i < MOTE_SCATTER_COUNT; i++) {
        const ang = this.rng.range(0, Math.PI * 2);
        const rad = Math.sqrt(this.rng.range(0, 1)) * (ISLAND_RADIUS - 2);
        const r = Math.max(MOTE_MIN_RADIUS, rad);
        add(Math.cos(ang) * r, Math.sin(ang) * r);
      }
    }
  }

  _buildShades(override) {
    this.shades = [];
    if (Array.isArray(override)) {
      for (const s of override) {
        const id = s.id || `S${++this.autoShadeN}`;
        const pos = Array.isArray(s.pos) ? s.pos : [0, 0, 0];
        this.shades.push({ id, x: pos[0], y: pos[1] || 0, z: pos[2], stun: 0, state: "chase" });
      }
    }
    // When random_shades != false, shades arrive over time via _spawnShades().
  }

  // ---- per-tick simulation ----

  emit(name, data) { this.pending.push({ name, data }); }

  /**
   * Advance exactly one tick. `input` is the already-resolved control state:
   *   { move:[x,z], camYaw:deg, jump:boolEdge, interact:boolEdge, pulse:boolEdge }
   * where the three buttons are TRUE only on the tick their press begins.
   * Returns the list of events produced this tick (each gets tick = this.tick).
   */
  step(input) {
    this.pending = [];
    if (this.state !== "playing") return this.pending;

    // Timers set in previous ticks age by dt before this tick's actions.
    this.player.invuln = Math.max(0, this.player.invuln - DT);
    this.pulseCooldown = Math.max(0, this.pulseCooldown - DT);

    this._movePlayer(input);
    this._pickup();
    if (input.interact) this._deposit();
    if (input.pulse) this._pulse();
    this._updateShades();

    this.tick += 1;

    // Win takes priority; otherwise dawn ends the night as a loss.
    if (this.state === "playing") {
      const timeLeft = this.startTimeLeft - this.tick / TICK_HZ;
      if (timeLeft <= 0) this._gameOver("lost", "dawn");
    }
    return this.pending;
  }

  _movePlayer(input) {
    const p = this.player;
    let [mx, mz] = clampLen(input.move?.[0] || 0, input.move?.[1] || 0, 1);
    const th = ((input.camYaw || 0) * Math.PI) / 180;
    const c = Math.cos(th), s = Math.sin(th);
    // Camera-relative to world (contract C).
    const wx = mx * c + mz * s;
    const wz = -mx * s + mz * c;
    p.x += wx * this.t.player_speed * DT;
    p.z += wz * this.t.player_speed * DT;

    // Vertical: jump is cosmetic but kept deterministic.
    if (input.jump && p.grounded) { p.vy = JUMP_SPEED; p.grounded = false; }
    p.vy -= GRAVITY * DT;
    p.y += p.vy * DT;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }

    // Clamp to the island disc (fall_enabled = false => no edge, no fall).
    const d = Math.hypot(p.x, p.z);
    if (d > ISLAND_RADIUS) { p.x = (p.x / d) * ISLAND_RADIUS; p.z = (p.z / d) * ISLAND_RADIUS; }
  }

  _pickup() {
    const p = this.player;
    for (const m of this.motes) {
      if (p.carried >= this.t.carry_capacity) break;
      if (!m.active) continue;
      if (distXZ(p.x, p.z, m.x, m.z) <= this.t.pickup_radius) {
        m.active = false;
        p.carried += 1;
        this.score += this.t.score.per_mote;
        this.emit("mote_picked", { carried: p.carried });
      }
    }
  }

  _deposit() {
    const p = this.player;
    if (p.carried <= 0) return;
    // Nearest unlit lantern within interact_radius.
    let best = null, bestD = Infinity;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = distXZ(p.x, p.z, l.x, l.z);
      if (d <= this.t.interact_radius && d < bestD) { best = l; bestD = d; }
    }
    if (!best) return;
    const amount = Math.min(p.carried, this.t.lantern_cost - best.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    best.deposited += amount;
    this.emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
    if (best.deposited >= this.t.lantern_cost && !best.lit) {
      best.lit = true;
      this.score += this.t.score.per_lantern;
      this.emit("lantern_lit", { lantern_id: best.id });
      if (this.lanterns.every((l) => l.lit)) {
        this._gameOver("won", "all_lit");
      }
    }
  }

  _pulse() {
    if (this.pulseCooldown > 0) return;
    const p = this.player;
    const stunned = [];
    for (const sh of this.shades) {
      const d = distXZ(p.x, p.z, sh.x, sh.z);
      if (d <= this.t.pulse_radius) {
        // Push away from the player (if exactly on top, push along +X).
        let dx = sh.x - p.x, dz = sh.z - p.z;
        const len = Math.hypot(dx, dz) || 1;
        if (Math.hypot(sh.x - p.x, sh.z - p.z) === 0) { dx = 1; dz = 0; }
        sh.x += (dx / len) * this.t.pulse_push_m;
        sh.z += (dz / len) * this.t.pulse_push_m;
        sh.stun = this.t.pulse_stun_s;
        sh.state = "stunned";
        stunned.push(sh.id);
      }
    }
    if (p.carried > 0) p.carried = Math.max(0, p.carried - this.t.pulse_cost);
    this.pulseCooldown = this.t.pulse_cooldown_s;
    this.score += this.t.score.per_stun * stunned.length;
    this.emit("pulse", { stunned_ids: stunned });
  }

  _spawnShades() {
    if (!this.autoShades) return;
    this.shadeSpawnTimer -= DT;
    if (this.shadeSpawnTimer > 0) return;
    this.shadeSpawnTimer = SHADE_SPAWN_INTERVAL_S;
    if (this.shades.length >= SHADE_MAX) return;
    const ang = this.rng.range(0, Math.PI * 2);
    const id = `S${++this.autoShadeN}`;
    this.shades.push({
      id,
      x: Math.cos(ang) * SHADE_SPAWN_RING,
      y: 0,
      z: Math.sin(ang) * SHADE_SPAWN_RING,
      stun: 0,
      state: "chase",
    });
    this.emit("shade_spawned", { id });
  }

  _updateShades() {
    this._spawnShades();
    const p = this.player;
    for (const sh of this.shades) {
      if (sh.stun > 0) {
        sh.stun = Math.max(0, sh.stun - DT);
        if (sh.stun === 0) sh.state = "chase";
      } else {
        // Chase the player on the XZ plane.
        const dx = p.x - sh.x, dz = p.z - sh.z;
        const len = Math.hypot(dx, dz);
        if (len > 1e-6) {
          const step = this.t.shade_speed * DT;
          sh.x += (dx / len) * step;
          sh.z += (dz / len) * step;
        }
        sh.state = "chase";
      }
      // Shades fear the lanterns: never inside safe_radius of any lantern.
      for (const l of this.lanterns) {
        const d = distXZ(sh.x, sh.z, l.x, l.z);
        if (d < this.t.safe_radius) {
          const len = d || 1;
          const nx = (sh.x - l.x) / len, nz = (sh.z - l.z) / len;
          sh.x = l.x + nx * this.t.safe_radius;
          sh.z = l.z + nz * this.t.safe_radius;
        }
      }
      // Contact damage (one hit per tick thanks to invulnerability).
      if (this.player.invuln <= 0 && sh.stun <= 0) {
        if (distXZ(p.x, p.z, sh.x, sh.z) <= this.t.shade_hit_radius) {
          this._hitPlayer();
          if (this.state !== "playing") return;
        }
      }
    }
  }

  _hitPlayer() {
    const p = this.player;
    p.flames -= 1;
    p.invuln = this.t.invuln_s;
    let dropped = 0;
    if (this.t.hit_drop_ratio > 0 && p.carried > 0) {
      dropped = Math.floor(p.carried * this.t.hit_drop_ratio);
      p.carried -= dropped;
    }
    this.emit("player_hit", { by: "shade", flames: p.flames, dropped });
    if (p.flames <= 0) this._gameOver("lost", "no_flames");
  }

  _gameOver(result, reason) {
    this.state = result;
    if (result === "won") {
      const timeLeft = Math.max(0, this.startTimeLeft - this.tick / TICK_HZ);
      this.score += this.t.score.per_second_left * Math.floor(timeLeft);
      this.score += this.t.score.per_flame_left * this.player.flames;
    }
    this.emit("game_over", { result, reason });
  }

  // ---- views ----

  get timeLeft() {
    return this.startTimeLeft - this.tick / TICK_HZ;
  }

  motesActive() {
    let n = 0;
    for (const m of this.motes) if (m.active) n++;
    return n;
  }
}
