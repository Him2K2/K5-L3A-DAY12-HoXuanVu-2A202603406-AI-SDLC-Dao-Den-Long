# Evidence phase4 (Contract v1.3)

Sinh tự động bằng `node scripts/gen-evidence.js` qua CLI headless thật (`src/headless/run.js`).
Mỗi case: scenario + inputs nằm trong `tests/headless-cases.json`; bản sao file đã chạy ở `cases/`; output JSONL ở thư mục này.

Node v22.5.1 · win32

## Scenario theo tính năng

| AC | Case | Đêm | Kết quả | Sự kiện quan sát được |
|----|------|-----|---------|----------------------|
| AC1.1 | `run-speed` | N1 | ✅ | night_start |
| AC1.3 | `dash` | N1 | ✅ | night_start, dash |
| AC1.6 | `deposit-and-light` | N1 | ✅ | night_start, deposit, lantern_lit |
| AC1.7 | `safe-zone-eject` | N1 | ✅ | night_start, deposit, lantern_lit |
| AC1.8 | `pulse-stun` | N1 | ✅ | night_start, pulse |
| AC1.11 | `shade-hit-drop` | N1 | ✅ | night_start, player_hit |
| AC1.10 | `shade-spawn-schedule` | N1 | ✅ | night_start, shade_spawned |
| AC1.12 | `fall-respawn` | N1 | ✅ | night_start, player_hit |
| AC1.15 | `pause-resume` | N1 | ✅ | night_start, paused, resumed |
| P3.13 | `dawn-survived` | N1 | ✅ | night_start, game_over |
| P3.13 | `dawn-too-few-lit` | N1 | ✅ | night_start, game_over |
| P3.12 | `all-lit-no-early-win` | N1 | ✅ | night_start, deposit, lantern_lit |
| P3.2 | `refuel` | N1 | ✅ | night_start, refuel |
| P3.4 | `lantern-out` | N1 | ✅ | night_start, lantern_out |
| P3.5 | `relight` | N1 | ✅ | night_start, deposit, lantern_lit |
| P3.7/P3.8 | `shade-drain` | N1 | ✅ | night_start, fuel_drain |
| P3.9/P3.16 | `drain-pulse-bonus` | N1 | ✅ | night_start, pulse |
| P3.10 | `refuel-ejects-shade` | N1 | ✅ | night_start, refuel |
| AC2.2 | `n2-bridge-and-pad` | N2 | ✅ | night_start |
| AC2.3 | `n3-ramp` | N3 | ✅ | night_start |
| AC2.4 | `n3-wind` | N3 | ✅ | night_start |
| AC3.1 | `drifter-spawn` | N2 | ✅ | night_start |
| AC3.3 | `drifter-steal` | N2 | ✅ | night_start, drifter_steal |
| AC3.4 | `drifter-pulse-drop` | N2 | ✅ | night_start, pulse, drifter_drop |
| AC3.5 | `charm` | N2 | ✅ | night_start, charm_picked |

## Tính tất định

| Đêm | Lần chạy | Kết quả |
|-----|----------|---------|
| Đêm 1 | 6000 tick, seed 42 | ✅ byte-identical |
| Đêm 2 | 6000 tick, seed 42 | ✅ byte-identical |
| Đêm 3 | 6000 tick, seed 42 | ✅ byte-identical |

## Hiệu năng headless (yêu cầu ≤ 30 s)

| Đêm | Độ dài | Thời gian | |
|-----|--------|-----------|--|
| Đêm 1 | 21 600 tick | 234 ms | ✅ |
| Đêm 2 | 21 600 tick | 292 ms | ✅ |
| Đêm 3 | 21 600 tick | 323 ms | ✅ |

Bộ test chi tiết (mỗi AC một test + regression các phase trước): xem `selftest.txt`.
