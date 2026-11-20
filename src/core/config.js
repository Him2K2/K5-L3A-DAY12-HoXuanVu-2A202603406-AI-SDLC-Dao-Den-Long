// Single source of truth for gameplay numbers — TICKET-02 standard values (Contract v1.1).
// game.contract.json mirrors DEFAULT_TUNING exactly (scripts/check-contract.js enforces it).

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const DEFAULT_TUNING = {
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  night2_duration_s: 330,
  night3_duration_s: 360,
  score: {
    per_mote: 10, // per mote DEPOSITED
    per_lantern: 100,
    per_stun: 5, // per shade hit by a pulse
    per_second_left: 2,
    per_flame_left: 50,
  },
};

// Fixed rules from TICKET-02 that have no tuning key.
export const R = {
  JUMP_SPEED: 7.0,
  GRAVITY: 20.0,
  PICKUP_DY: 1.5, // max height gap feet <-> mote ground point
  HIT_DY: 1.5, // max height gap feet <-> shade centre
  STEP_UP: 0.3, // walkable step / ramp tolerance
  FALL_Y: -10,
  FALL_WAIT_T: 60,
  INVULN_T: 90,
  DASH_T: 12,
  DASH_CD_T: 90,
  PULSE_CD_T: 180,
  PULSE_CENTER_DY: 0.8,
  STUN_T: 120,
  PUSH_T: 15,
  RECOIL_T: 60,
  RECOIL_M: 2.0,
  SAFE_EJECT_T: 30,
  SHADE_HOVER: 1.0,
  SHADE_DETECT: 12,
  SHADE_GIVEUP: 18,
  SHADE_SPAWN_T: 30, // "spawning" state length (assumption)
  SHADE_FIRST_SPAWN: 300, // 2 shades at sim tick 300
  SHADE_MIN_PLAYER_DIST: 15,
  WANDER_SPEED: 1.5,
  WANDER_RADIUS: 5,
  MOTE_START: 20,
  MOTE_CAP: 30,
  MOTE_SPAWN_EVERY: 240,
  DROP_TTL_T: 480,
  DROP_R_MIN: 1.5,
  DROP_R_MAX: 2.5,
  CHARM_T: 600,
  CHARM_RESPAWN_T: 2700,
  CHARM_SPEED: 7.2,
  DRIFTER_SPEED: 7.0,
  DRIFTER_IDLE_SPEED: 2.0,
  DRIFTER_MAX: 2,
  DRIFTER_EVERY: 1200,
  DRIFTER_CHASE_CARRY: 5,
  DRIFTER_CHASE_DIST: 15,
  DRIFTER_TOUCH: 1.2,
  DRIFTER_STEAL: 3,
  DRIFTER_FLEE_T: 240,
  DRIFTER_DROP_VANISH_T: 120,
  DRIFTER_HOVER: 1.2,
  WIND_EVERY: 1800,
  WIND_LEN: 300,
  WIND_WARN: 120,
  WIND_SPEED: 2.0,
};

export function cloneTuning(t = DEFAULT_TUNING) {
  return { ...t, score: { ...t.score } };
}
