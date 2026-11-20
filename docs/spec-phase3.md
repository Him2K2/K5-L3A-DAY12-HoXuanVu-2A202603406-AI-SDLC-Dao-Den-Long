# Spec Phase 3 — TICKET-03 "Đèn cạn dầu" (Contract v1.2)

Viết trước khi code. Quyết định thiết kế: [ADR 0001](adr/0001-lantern-fuel-and-dawn-win.md).
Thay đổi phá vỡ tương thích: [CHANGELOG.md](../CHANGELOG.md). Mỗi AC ↔ test tên `P3.x` trong
`scripts/selftest.js` và/hoặc case trong `tests/headless-cases.json`.

## 1. Nhiên liệu đèn
| AC | Tiêu chí |
|----|----------|
| P3.1 | Thắp (lần đầu / lại) → `fuel = 100`; đang sáng hao đúng 1/giây (60 tick → −1.0) |
| P3.2 | Châm dầu ở đèn sáng: `used = min(mang, ceil((100 − fuel)/10))`, `fuel = min(100, fuel + 10·used)`; sự kiện `refuel {lantern_id, amount, fuel}`; +5/đom đóm |
| P3.3 | Đèn đầy dầu không được chọn khi tương tác (không sự kiện, không điểm); chọn gần nhất trong các đèn nhận được, bằng nhau → id nhỏ |
| P3.4 | `fuel ≤ 0` → tắt ngay sau bước 2: `lantern_out`, `deposited = 0`, `ever_lit = true`, `fuel: 0` trong snapshot |
| P3.5 | Thắp lại đèn `ever_lit` cần 5; `lantern_lit.relight = true`, `relit_count += 1`, +40; đèn chưa từng sáng cần 10, +100 |

## 2. Bóng Mực hút dầu
| AC | Tiêu chí |
|----|----------|
| P3.6 | Đèn `fuel < 30` mất vùng an toàn; đúng 30 vẫn còn |
| P3.7 | Chỉ Bóng `wander` đi tới đèn yếu gần nhất; trong 2 m → `drain`, đứng yên, hút 5/giây, cộng dồn nhiều con, đèn vẫn tự hao 1/giây |
| P3.8 | `fuel_drain {lantern_id, shade_id, fuel}` mỗi 60 tick đang hút |
| P3.9 | `drain → chase` khi Mây trong 6 m; `→ stunned` khi trúng Tỏa Sáng; `→ wander` khi đèn tắt / dầu ≥ 30 / cách > 2 m; hết choáng → `wander` |
| P3.10 | Châm dầu lên ≥ 30 khi có Bóng trong 6 m → đẩy ra mép trong ≤ 30 tick, không gây sát thương |

## 3. Luật thắng
| AC | Tiêu chí |
|----|----------|
| P3.11 | Thời lượng 240 / 270 / 300 s |
| P3.12 | Thắp đủ đèn **không** kết thúc Đêm |
| P3.13 | Bình minh: sống và đèn sáng ≥ ceil(0.6·tổng) (3/5, 4/6, 5/7) → `won / dawn_survived`; thiếu → `lost / dawn` |
| P3.14 | Hết Ngọn Lửa → `lost / no_flames` ngay, kể cả ở tick bình minh |

## 4. Sức chứa
| AC | Tiêu chí |
|----|----------|
| P3.15 | Sức chứa = min(20, 10 + 2·successful_lights); thắp lại cũng tính; đèn đặt sẵn không tính; snapshot `player.capacity` |

## 5. Điểm
| AC | Tiêu chí |
|----|----------|
| P3.16 | +5/đom đóm nạp (thắp, thắp lại, châm); +100 thắp lần đầu; +40 thắp lại; Tỏa Sáng +5/con, +15 nếu con đó đang `drain` |
| P3.17 | Thắng: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa +50; không còn thưởng thời gian; thua không có thưởng |

## 6. Chế độ mù màu (bản chơi)
| AC | Tiêu chí | Kiểm chứng |
|----|----------|-----------|
| P3.18 | Cài đặt "Bảng màu dễ phân biệt", được lưu | thủ công + `localStorage` |
| P3.19 | Viền/mắt Bóng Mực `#7A3CFF → #00B3FF`; cảnh báo UI `#FF5A5F → #FFFFFF` kèm ⚠ | đọc `web/palette.js` + ảnh |
| P3.20 | Đèn tắt xẹp 20% + giấy rách; đèn sắp hết dầu nhấp nháy (1 Hz) — phân biệt không cần màu | ảnh |

## 7. Contract v1.2
| AC | Tiêu chí |
|----|----------|
| P3.21 | `contract_version "1.2"`, tuning thêm 8 khoá, thời lượng mới |
| P3.22 | Snapshot: đèn có `fuel` (1 chữ số thập phân, tắt = 0), `ever_lit`, `relit_count`; `player.capacity`; trạng thái `drain` |
| P3.23 | Scenario: đèn `lit/fuel/ever_lit` (`lit:true` thiếu fuel → 100); `player.successful_lights`; `shades[].target_lantern_id` |
| P3.24 | Regression: mọi test Phase 1–2 **không bị thay thế** vẫn đạt |
