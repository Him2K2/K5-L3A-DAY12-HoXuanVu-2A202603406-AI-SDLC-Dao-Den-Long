// Deterministic PRNG (mulberry32). Same seed => same sequence, on every run/machine.
// We never use Math.random anywhere in the simulation; all randomness flows through this.

export function makeRNG(seed) {
  // Force to uint32. seed 0 is allowed.
  let a = (seed >>> 0) || 0;
  return {
    // float in [0, 1)
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // float in [min, max)
    range(min, max) {
      return min + this.next() * (max - min);
    },
    // int in [min, max] inclusive
    int(min, max) {
      return Math.floor(min + this.next() * (max - min + 1));
    },
  };
}
