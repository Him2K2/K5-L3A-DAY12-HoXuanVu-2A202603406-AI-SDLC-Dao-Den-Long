// Standard maps from TICKET-02, Part 2. Angles: (x, z) = (r cos a, r sin a), a from +X.
// ground(x, z) returns the walkable surface height, or -Infinity over the cloud sea.

const NONE = -Infinity;
const rad = (d) => (d * Math.PI) / 180;

function ring(r, startDeg, stepDeg, count, cx = 0, cz = 0, y = 0) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = rad(startDeg + stepDeg * i);
    out.push([cx + r * Math.cos(a), y, cz + r * Math.sin(a)]);
  }
  return out;
}

const lanterns = (list) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));

// ---------- Night 1 — Đảo Bến ----------
const N1 = {
  night: 1,
  name: "Đảo Bến",
  durationKey: "night1_duration_s",
  start: [0, 0, 0],
  lanterns: lanterns([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
  motePoints: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
  shadePoints: ring(37, 15, 30, 12),
  shadeEvery: 480,
  shadeMax: 6,
  shadeSpeed: null, // tuning.shade_speed
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  ground(x, z) {
    return x * x + z * z <= 40 * 40 ? 0 : NONE;
  },
  shadeBlocked(x, z) {
    return this.ground(x, z) === NONE;
  },
};

// ---------- Night 2 — Đảo Cau ----------
const B = [70, 0];
const N2 = {
  night: 2,
  name: "Đảo Cau",
  durationKey: "night2_duration_s",
  start: [0, 0, 0],
  lanterns: lanterns([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
  motePoints: [
    ...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8),
    ...ring(10, 0, 90, 4, B[0], B[1]), ...ring(22, 0, 45, 8, B[0], B[1]),
  ],
  shadePoints: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, B[0], B[1])],
  shadeEvery: 420,
  shadeMax: 8,
  shadeSpeed: null,
  pads: [
    { pos: [20, 0, 18], r: 1, vy: 14, vh: 24, target: [70, 0] },
    { pos: [50, 0, -18], r: 1, vy: 14, vh: 24, target: [0, 0] },
  ],
  charms: [{ id: "C1", pos: [35, 0, 0] }],
  drifters: true,
  wind: false,
  ground(x, z) {
    if (x * x + z * z <= 28 * 28) return 0;
    const bx = x - B[0];
    if (bx * bx + z * z <= 28 * 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0; // bamboo bridge, no rails
    return NONE;
  },
  shadeBlocked(x, z) {
    return this.ground(x, z) === NONE;
  },
};

// ---------- Night 3 — Đảo Chuông ----------
const RAMPS = [30, 150].map((d) => ({ ux: Math.cos(rad(d)), uz: Math.sin(rad(d)) }));
const N3 = {
  night: 3,
  name: "Đảo Chuông",
  durationKey: "night3_duration_s",
  start: [0, 0, -30], // (0,0,0) is inside the bell tower — see docs/assumptions.md
  lanterns: lanterns([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
  motePoints: [
    ...ring(34, 0, 20, 18, 0, 0, 0),
    ...ring(18, 20, 20, 8, 0, 0, 3),
    ...ring(5, 45, 90, 4, 0, 0, 6),
  ],
  shadePoints: ring(43, 0, 22.5, 16),
  shadeEvery: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, vh: 8, dir: [0, -1] }],
  charms: [{ id: "C1", pos: [30, 0, 25] }, { id: "C2", pos: [-30, 0, 25] }],
  drifters: true,
  wind: true,
  ground(x, z) {
    const r2 = x * x + z * z;
    if (r2 > 45 * 45) return NONE;
    const r = Math.sqrt(r2);
    if (r <= 2) return 14; // bell tower: 8 m tall on tier 2 => unclimbable wall
    if (r <= 8) return 6; // tier 2
    let h = 0;
    if (z > 0 && r >= 12 && r <= 24) h = 3; // tier 1 (half annulus)
    for (const u of RAMPS) {
      const along = x * u.ux + z * u.uz;
      const perp = Math.abs(x * u.uz - z * u.ux);
      if (along >= 24 && along <= 30 && perp <= 1.5) h = Math.max(h, (3 * (30 - along)) / 6);
    }
    return h;
  },
  shadeBlocked(x, z) {
    return this.ground(x, z) === NONE || x * x + z * z <= 4;
  },
};

export const MAPS = { 1: N1, 2: N2, 3: N3 };
export function getMap(night) {
  const m = MAPS[night];
  if (!m) throw new Error(`unknown night ${night}`);
  return m;
}
