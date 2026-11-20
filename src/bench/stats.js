// TICKET-04 §1 frame statistics from per-frame durations dt_i (ms).
//   avg_fps      = 1000·N / Σ dt_i
//   p1_low_fps   = 1000 / mean of the k largest dt, k = max(1, ceil(0.01·N))
//   frame_ms_p95 = 95th percentile of dt (nearest-rank)
const r1 = (x) => Math.round(x * 10) / 10;

export function benchStats(dts) {
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const desc = [...dts].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = desc.slice(0, k).reduce((a, b) => a + b, 0) / k;
  const asc = [...dts].sort((a, b) => a - b);
  const p95 = asc[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
  return { frames: N, avg_fps: r1((1000 * N) / sum), p1_low_fps: r1(1000 / worst), frame_ms_p95: r1(p95) };
}
