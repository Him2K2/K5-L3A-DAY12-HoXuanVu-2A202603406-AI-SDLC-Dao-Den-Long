// TICKET-04 §1 — the standard benchmark scene (identical for every run with the same seed).
// Pure: used by the browser bench page and by the self-tests.
import { makeRNG } from "../core/prng.js";
import { getMap } from "../core/maps.js";

export const BENCH = {
  shades: 200,
  motes: 100,
  islandR: 39, // scatter inside Night 1's 40 m island
  safeR: 6, // keep out of L1-L3 safe zones so no shade starts inside one
  camR: 30,
  camY: 15,
  camPeriodS: 15,
  warmupS: 3,
};

// Uniform over the disc area (r = R·sqrt(u)), seeded.
function scatter(rng, n, avoid) {
  const out = [];
  while (out.length < n) {
    const r = BENCH.islandR * Math.sqrt(rng.next());
    const a = rng.next() * Math.PI * 2;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    if (avoid && avoid(x, z)) continue;
    out.push([x, z]);
  }
  return out;
}

export function buildBenchScenario(seed = 42) {
  const rng = makeRNG(seed);
  const lit = getMap(1).lanterns.slice(0, 3); // L1–L3 lit, fuel 100
  const inZone = (x, z) => lit.some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < BENCH.safeR);
  const shades = scatter(rng, BENCH.shades, inZone).map(([x, z], i) => ({ id: `S${i + 1}`, pos: [x, 1, z], state: "wander" }));
  const motes = scatter(rng, BENCH.motes, null).map(([x, z]) => [x, 0, z]);
  return {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0] },
    lanterns: lit.map((l) => ({ id: l.id, lit: true, fuel: 100 })),
    shades, motes, drifters: [], charms: [],
  };
}

// Camera orbit: centre (0,0,0), radius 30 m, height 15 m, starts at (30,15,0), counter-clockwise seen from
// above in the tickets' angle convention (x, z) = (r cos a, r sin a), one lap per 15 s.
export function benchCamera(tSec) {
  const a = (2 * Math.PI * tSec) / BENCH.camPeriodS;
  return [BENCH.camR * Math.cos(a), BENCH.camY, BENCH.camR * Math.sin(a)];
}
