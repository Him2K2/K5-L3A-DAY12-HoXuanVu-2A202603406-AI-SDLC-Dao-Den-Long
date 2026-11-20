# Evidence Phase 2 (Contract v1.1)

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
| AC1.13 | `win-all-lit` | N1 | ✅ | night_start, deposit, lantern_lit, game_over |
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
| Đêm 1 | 21 600 tick | 231 ms | ✅ |
| Đêm 2 | 21 600 tick | 269 ms | ✅ |
| Đêm 3 | 21 600 tick | 281 ms | ✅ |

Bộ test chi tiết (37 test, một test cho mỗi AC + regression Phase 1): xem `selftest.txt`.
