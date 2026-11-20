# Changelog

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
3 Đêm chuẩn hoá, Lướt, Gió Lạc, Bùa Gió, gió mạnh, tạm dừng, menu/HUD/âm thanh. Chi tiết: `docs/spec-phase2.md`.

## [phase-1] — Contract v1.0 · PRD-0
Lõi tất định + headless + bản chơi web Đêm 1.
