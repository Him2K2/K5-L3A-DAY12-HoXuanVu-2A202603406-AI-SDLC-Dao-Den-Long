# Changelog

## [phase-4 / v1.0.0] — Contract v1.3 · TICKET-04 "Bình minh: phát hành v1.0.0" (2026-11-20)

Spec: [docs/spec-phase4.md](docs/spec-phase4.md) · Retro: [docs/retro.md](docs/retro.md).

### Thêm
- **Benchmark** `node scripts/bench.js --seed 42 --duration 30 --out bench.json`: Puppeteer mở Chrome **có cửa sổ**
  1280×720, tắt vsync, chạy cảnh chuẩn (Đêm 1, 200 Bóng `wander`, 100 đom đóm, L1–L3 sáng, camera bay vòng
  r = 30, Y = 15, 15 giây một vòng, 3 giây khởi động). Ghi `avg_fps`, `p1_low_fps`, `frame_ms_p95`, `frames`,
  `load_ms`, `peak_mem_mb` (RSS cả cây tiến trình Chrome). Lõi có thêm cờ `bench` (mặc định tắt) để tắt sinh
  thêm / sát thương / nhặt / hao dầu / kết thúc Đêm.
- **Soak** `node --expose-gc --no-opt scripts/soak.js --seed 7 --nights 10 --out soak.json`: 10 Đêm một tiến trình,
  input ngẫu nhiên theo seed; ghi crashes, RSS đầu/cuối và `heapUsed` đầu/cuối.
- **Bảng xếp hạng cục bộ**: nhập tên sau màn Bình Minh / khi thua (3–12 ký tự, có tiếng Việt có dấu), top 10,
  lưu `data/leaderboard.json` qua server (bản web tĩnh dùng `localStorage`), màn hình từ menu,
  `node server.js --export-leaderboard out.json`.
- **Dễ tiếp cận**: đổi phím mọi hành động (báo trùng, khôi phục mặc định), phụ đề/chỉ báo hình ảnh (Bóng xuất hiện
  + mũi tên mép màn hình, gió, 10 giây cuối, đèn cạn dầu, đèn tắt), giảm chuyển động (tắt rung/chớp/nhấp nháy),
  chữ ≥ 18 px và chữ lớn ×1.25.
- **Góc nhìn thứ nhất xoay theo chuột** như game bắn súng (ngang + dọc ±80°, khoá chuột khi vào đảo), có tâm ngắm
  và đèn lồng cầm tay. Lõi vẫn chỉ nhận `cam_yaw_deg`.
- Đóng gói: three.js r160 vendored (`web/vendor/`, chạy offline), `scripts/build-web.js` → zip web tĩnh cho
  Release, `LICENSE` (MIT), README đầy đủ, retro, kịch bản video demo.

### Thay đổi
- `run_cmd` đổi từ `npm start` thành **`node server.js`** (để `--export-leaderboard` không bị npm nuốt cờ);
  server tự mở trình duyệt (`--no-open` để tắt), chỉ nghe trên 127.0.0.1.
- Thử nghiệm chế độ góc nhìn thứ ba bật bằng phím `V` đã **bị bỏ** theo phản hồi playtest: chỉ giữ một camera
  xoay theo chuột.
- Lõi giảm cấp phát mỗi tick (đom đóm lọc/nhặt tại chỗ, tái dùng bộ đệm sự kiện). Output headless không đổi
  (test tất định vẫn byte-identical).

### Sửa
- `scripts/gen-evidence.js` từng xoá cả thư mục `evidence/<phase>/`, nên **ảnh Phase 2 bị xoá trước commit
  `phase-2`**. Nay script chỉ thay phần do nó sinh ra; ảnh Phase 2 đã được khôi phục (xem
  `evidence/phase2/screens/README.md`).
- CSS: `html, body { font-size: 1rem }` làm chữ gốc thành 16 px; đã sửa để chữ gốc là 18 px.

### Contract v1.3
- `contract_version: "1.3"`, thêm `bench_cmd` và `soak_cmd`; v1.0–v1.2 giữ nguyên (selftest 60/60, gồm toàn bộ regression).

## [phase-3+] — sau tag `phase-3`, trước Phase 4
- Góc nhìn thứ nhất xoay theo chuột (bản đầu, kèm phím `V`; phím `V` đã bỏ ở Phase 4).

## [phase-3] — Contract v1.2 · TICKET-03 "Đèn cạn dầu" (2026-11-20)

Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md) ·
Spec: [docs/spec-phase3.md](docs/spec-phase3.md).

### ⚠ Breaking changes (phá vỡ tương thích)

| # | Trước (v1.1) | Sau (v1.2) | Ảnh hưởng |
|---|--------------|------------|-----------|
| B1 | Thắp hết đèn → thắng ngay, `reason: "all_lit"` | **Không còn thắng sớm.** Thắng chỉ ở bình minh khi còn sống và đèn sáng ≥ ceil(0.6 × tổng): `reason: "dawn_survived"`. `all_lit` **không còn được phát** | Mọi test/tool chờ `all_lit` phải chuyển sang `dawn_survived` |
| B2 | Đèn đã sáng là vĩnh viễn, không nhận đom đóm | Đèn có `fuel` (hao 1/s), hết dầu thì tắt (`lantern_out`). Đèn sáng **nhận châm dầu** (`refuel`) khi bấm Tương tác | Bấm E ở đèn sáng giờ có tác dụng; chọn đèn xét cả đèn sáng chưa đầy |
| B3 | Bóng Mực không bao giờ vào vùng an toàn của đèn sáng | Vùng an toàn chỉ có khi `fuel ≥ 30`; Bóng `wander` bị đèn yếu hút tới và **`drain`** | Thêm trạng thái Bóng Mực `drain`; người chơi không còn an toàn tuyệt đối ở chân đèn |
| B4 | Hết choáng: trong 18 m → `chase`, ngoài → `wander` | Hết choáng **luôn** → `wander` (có thể chuyển `chase` ngay ở bước di chuyển nếu Mây ≤ 12 m) | Chỉ khác khi Mây ở 12–18 m |
| B5 | Thời lượng Đêm 300 / 330 / 360 s | **240 / 270 / 300 s** | `time_left_s` ban đầu đổi |
| B6 | Điểm: +10/đom đóm nạp, +100/đèn, thưởng floor(giây còn) × 2 | +5/đom đóm nạp (thắp, thắp lại, châm), +100 thắp lần đầu, +40 thắp lại, Tỏa Sáng +5 (+15 nếu Bóng đang `drain`), bình minh: mỗi đèn sáng 50 + floor(fuel). **Bỏ thưởng thời gian** | Mọi kỳ vọng điểm cũ sai |
| B7 | Sức chứa cố định 10 | min(20, 10 + 2 × số lần thắp thành công trong Đêm) | Nhặt được nhiều hơn 10 |
| B8 | `wander` lượn quanh điểm "nhà" | `wander` đi tới đèn yếu gần nhất (tốc độ Bóng) → nếu không có thì lượn quanh **đèn tắt** gần nhất | Vị trí Bóng ở Đêm mặc định thay đổi |

### Thêm vào contract (tương thích ngược)
- `contract_version: "1.2"`; tuning thêm `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio,
  drain_per_s, low_fuel_threshold, capacity_max`; `score` thêm 3 khoá mô tả (`per_relight`, `per_stun_draining`,
  `per_lit_lantern_at_dawn`), `per_second_left = 0`.
- Snapshot: đèn có `fuel` (1 chữ số thập phân, tắt = 0), `ever_lit`, `relit_count`; `player.capacity`;
  Bóng Mực có thêm `target_lantern_id` (ngoài contract, để debug).
- Scenario: đèn `lit / fuel / ever_lit` (`lit: true` thiếu `fuel` → 100), `player.successful_lights`,
  `shades[].target_lantern_id`.
- Sự kiện mới: `refuel {lantern_id, amount, fuel}`, `lantern_out {lantern_id}`,
  `fuel_drain {lantern_id, shade_id, fuel}` (mỗi 60 tick hút), `lantern_lit.relight`.

### Bản chơi
- Thanh dầu trên đèn sáng; đèn + thanh nhấp nháy 1 Hz khi fuel < 30; vòng vùng an toàn ẩn khi đèn yếu.
- Tia hút dầu giữa Bóng `drain` và đèn; cảnh báo "Đèn Lx sắp cạn dầu"; âm thanh châm dầu / đèn tắt / bị hút.
- HUD: `đang mang / sức chứa` (thanh 10–20 ô), "Đèn sáng k/n · cần m"; nhắc "E — Châm dầu (fuel/100)" / "Thắp lại (x/5)".
- **Cài đặt "Bảng màu dễ phân biệt"** (lưu): viền/mắt Bóng `#00B3FF`, cảnh báo UI `#FFFFFF` + ⚠,
  đèn tắt xẹp 20% + giấy rách.

### Test cập nhật / xoá (không skip âm thầm)

| Test | Hành động | Lý do |
|------|-----------|-------|
| `AC1.6` deposit | **Cập nhật** | B6: điểm 70 → 35, 130 → 115. B2: luật "bỏ qua đèn đã sáng" không còn — case `skip` dời L1 ra 1.8 m để kiểm "đèn nhận được gần nhất thắng" |
| `AC1.13` judge order | **Cập nhật** | B1: `all_lit` → `dawn_survived` (5/5 sáng ở tick bình minh) |
| `AC1.14` win score | **Xoá** | B6: công thức điểm cũ bị thay toàn bộ (bỏ thưởng thời gian, bỏ thắng sớm). Thay bằng `P3.17` |
| `AC1.15` pause | **Cập nhật** | B5: Đêm 1 dài 240 s nên `time_left_s` kỳ vọng đổi |
| `AC4.5` shade states | **Cập nhật** | Thêm `drain` vào tập trạng thái hợp lệ |
| case `win-all-lit` | **Thay** bằng `dawn-survived` | B1 |
| case `deposit-and-light` | **Cập nhật** | B6: điểm 200 → 150 |

Mọi test khác của Phase 1–2 giữ nguyên và vẫn đạt (regression).

## [phase-2] — Contract v1.1 · TICKET-02 "Ba hòn đảo"
Spec: `docs/spec-phase2.md`.
- **Breaking:** mọi số liệu tự chọn ở Phase 1 bị thay bằng số chuẩn (sức chứa 10, chi phí đèn 10, Tỏa Sáng 3 đom đóm,
  rơi khỏi đảo bị phạt, thời lượng 300 / 330 / 360 s…); điểm +10 mỗi đom đóm **nạp** (thay vì nhặt).
- 3 Đêm theo bản đồ chuẩn (Đảo Bến, Đảo Cau có cầu tre + bục nhảy, Đảo Chuông 3 tầng + dốc + tháp chuông + gió mạnh).
- Lướt, Gió Lạc, Bùa Gió, tạm dừng; trạng thái Bóng Mực `spawning/wander/chase/recoil/stunned`; thứ tự 12 bước/tick.
- Bản chơi: menu → giới thiệu Đêm (Ông Đăng) → chơi → kết quả → Bình Minh; HUD đầy đủ; cài đặt được lưu;
  âm thanh WebAudio; bảng màu chuẩn.
- Contract v1.1: `--night 1|2|3`, snapshot/scenario/sự kiện mở rộng.
- Sửa lỗi playtest Phase 1: phím A/D bị ngược; cảnh quá tối (three.js dùng đơn vị ánh sáng vật lý).

## [phase-1] — Contract v1.0 · PRD-0
- Lõi mô phỏng tất định (`src/core/`) dùng chung cho headless và bản chơi; PRNG theo seed.
- Headless theo Test Contract v1.0 (JSONL snapshot/event/end, exit code 2 khi file sai định dạng).
- Bản chơi web three.js Đêm 1: nhặt đom đóm, thắp 5 đèn, Bóng Mực, Tỏa Sáng, HUD, chơi lại.
