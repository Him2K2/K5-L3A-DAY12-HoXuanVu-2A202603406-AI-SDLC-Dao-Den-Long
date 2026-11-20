// Single source of truth for all gameplay numbers.
// game.contract.json mirrors DEFAULT_TUNING exactly (see scripts/check-contract.js).

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

// Fixed world layout for Night 1.
export const ISLAND_RADIUS = 40; // player cannot leave this disc (fall_enabled = false)
export const LANTERN_IDS = ["L1", "L2", "L3", "L4", "L5"];
// Pentagon at radius 25. L1 sits at [0,0,25] to match the contract's scenario example.
export const LANTERN_POSITIONS = {
  L1: [0, 0, 25],
  L2: [-23.776, 0, 7.725],
  L3: [-14.695, 0, -20.225],
  L4: [14.695, 0, -20.225],
  L5: [23.776, 0, 7.725],
};

// Internal (non-tuning) constants. Jump is cosmetic for the contract: gameplay
// radii are measured in XZ, so vertical motion never changes pickups/hits.
export const JUMP_SPEED = 7.0; // m/s
export const GRAVITY = 20.0; // m/s^2
export const MOTE_SCATTER_COUNT = 40; // default-night motes when random_motes != false
export const MOTE_MIN_RADIUS = 4; // scattered motes avoid the dead centre
export const SHADE_SPAWN_INTERVAL_S = 12; // default-night auto-spawn cadence
export const SHADE_MAX = 6; // cap on simultaneous auto-spawned shades
export const SHADE_SPAWN_RING = 38; // auto-spawn near the island rim

export const DEFAULT_TUNING = {
  player_speed: 6.0,
  carry_capacity: 5,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6.0,
  night1_duration_s: 180,
  flames: 3,
  invuln_s: 1.0,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 3.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 8.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 2,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 1,
    per_flame_left: 50,
  },
};

// Deep-ish clone so a Game instance can't mutate the shared defaults.
export function cloneTuning(t = DEFAULT_TUNING) {
  return { ...t, score: { ...t.score } };
}
