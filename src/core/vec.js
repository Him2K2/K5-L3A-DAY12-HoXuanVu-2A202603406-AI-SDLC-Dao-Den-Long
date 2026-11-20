// Tiny 2D helpers on the horizontal XZ plane. The contract measures all gameplay
// distances in XZ, in metres, and "within radius r" means distance <= r.

export function distXZ(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function dist2XZ(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Round to 3 decimals for JSONL output (contract: coordinates rounded to 3 dp).
export function r3(x) {
  // Avoid "-0" and tiny -0.0004 artifacts.
  const v = Math.round((x + Number.EPSILON) * 1000) / 1000;
  return v === 0 ? 0 : v;
}

export function clampLen(x, z, maxLen) {
  const len = Math.sqrt(x * x + z * z);
  if (len <= maxLen || len === 0) return [x, z];
  const s = maxLen / len;
  return [x * s, z * s];
}
