# ADR 0001 — Đèn có nhiên liệu, Bóng Mực hút dầu, thắng khi sống tới bình minh

- **Trạng thái:** Chấp nhận (Phase 3, TICKET-03, Contract v1.2)
- **Ngày:** 2026-11-20
- **Thay thế:** luật "đèn đã sáng là vĩnh viễn", "Bóng Mực không bao giờ vào vùng an toàn",
  "thắng ngay khi thắp hết đèn" (Phase 2).

## Bối cảnh

Playtest: người chơi giỏi thắp hết đèn trong ~2 phút rồi game kết thúc, thiếu căng thẳng cuối Đêm.
Nhà thiết kế đổi mục tiêu từ *"thắp hết"* sang *"giữ đảo sáng tới bình minh"*.

## Quyết định

### 1. Mô hình trạng thái đèn

Trước (Phase 2) đèn có 2 trạng thái, một chiều: `unlit → lit` (vĩnh viễn).
Nay đèn là một máy trạng thái **có vòng lặp**, thêm biến `fuel`, `ever_lit`, `relit_count`:

```
            nạp đủ 10 (lần đầu)                 fuel ≤ 0 (hao 1/s + hút 5/s mỗi Bóng)
  UNLIT ─────────────────────────▶ LIT ───────────────────────────────▶ OUT (= UNLIT, ever_lit)
 (ever_lit=false)                 fuel=100  ◀──────────────────────────  nạp đủ 5 (thắp lại)
                                   │  ▲                                  relit_count += 1
                         châm dầu  │  │  fuel += 10 × used
                                   ▼  │
                       LIT & fuel < 30 = "đèn yếu": mất vùng an toàn, Bóng wander bị hút tới
```

- **Lưu trữ:** `fuel` được giữ dưới dạng **số nguyên đơn vị 1/60** (`fuelU`, tối đa 6000). Hao 1 đơn vị/tick,
  hút 5 đơn vị/tick/Bóng → không có sai số dấu phẩy động, tất định tuyệt đối. Chỉ đổi sang số thực
  (1 chữ số thập phân) khi xuất snapshot/sự kiện.
- **Thời điểm:** trừ dầu ở **bước 2** (bộ đếm) của tick; **ngay sau bước 2**, đèn có `fuelU ≤ 0` tắt
  (`lantern_out`, `deposited = 0`, `ever_lit = true`). Vì vậy một đèn tắt sẽ thôi có vùng an toàn
  trước khi Bóng Mực di chuyển trong cùng tick.
- **Vùng an toàn** chỉ tồn tại khi `lit && fuel ≥ 30` (đúng 30 vẫn còn). Mọi nơi kiểm vùng an toàn
  (chặn di chuyển, đẩy ra, chọn điểm sinh) dùng chung một hàm `_hasSafeZone(l)`.
- **Tương tác** chọn trong các đèn "nhận được": chưa sáng, hoặc sáng nhưng chưa đầy dầu. Đèn sáng →
  châm dầu (`refuel`); đèn chưa sáng → nạp (`deposit`), chi phí 10 hoặc 5 nếu `ever_lit`.

### 2. Bóng Mực: trạng thái mới `drain`

`spawning → wander ⇄ chase → recoil`, `* → stunned`, và mới: `wander → drain`.

- `wander` chọn đèn yếu gần nhất (bằng nhau → id nhỏ), đi tới bằng tốc độ Bóng chuẩn; trong 2 m → `drain`.
- `drain` đứng yên, hút 5 fuel/giây; ghi `fuel_drain` mỗi 60 tick hút liên tục.
- Rời `drain`: Mây trong 6 m → `chase` (ưu tiên); đèn tắt / dầu ≥ 30 / xa > 2 m → `wander`;
  trúng Tỏa Sáng → `stunned`. **Hết choáng luôn về `wander`** (thay cho "trong 18 m thì chase").
- Khi châm dầu đưa đèn lên ≥ 30 mà còn Bóng trong 6 m: tái dùng đúng cơ chế đẩy-ra-mép 30 tick
  không gây sát thương của Phase 2 (vùng an toàn "xuất hiện lại"); Bóng đang `drain` ở đó chuyển `wander`.

### 3. Luật thắng

Bỏ thắng sớm. Bước "xét thắng/thua" vẫn ở cuối tick:

1. Hết Ngọn Lửa → thua `no_flames` (luôn ưu tiên, kể cả tick bình minh).
2. Hết giờ → số đèn đang sáng ≥ `ceil(win_ratio × tổng)` ⇒ thắng `dawn_survived`, ngược lại thua `dawn`.

Điểm thưởng bình minh (chỉ khi thắng): mỗi đèn đang sáng `50 + floor(fuel)`, mỗi Ngọn Lửa `50`.
Bỏ thưởng thời gian. Sức chứa = `min(20, 10 + 2 × successful_lights)`.

## Các phương án đã cân nhắc

| Phương án | Lý do không chọn |
|-----------|------------------|
| Lưu `fuel` bằng số thực, trừ 1/60 mỗi tick | Sai số tích luỹ (100 − 6000 × 1/60 ≠ 0 chính xác) có thể làm đèn tắt lệch 1 tick giữa các máy/bản. Ticket cũng khuyên dùng số nguyên. |
| Thêm trạng thái đèn riêng `out` | Đèn tắt hành xử y hệt chưa sáng (nhận đom đóm), chỉ khác chi phí. Một cờ `ever_lit` đủ, ít nhánh hơn, snapshot vẫn chỉ `lit: true/false` như contract. |
| Cho Bóng `chase` cũng bị đèn yếu thu hút | Ticket ghi rõ Bóng đang chase không đổi mục tiêu. |
| Hút dầu ở bước di chuyển Bóng (bước 8) | Ticket yêu cầu trừ dầu ở bước 2; giữ một chỗ duy nhất cho mọi thay đổi dầu theo thời gian. |

## Hệ quả

- Snapshot/scenario/sự kiện mở rộng theo Contract v1.2 (xem `CHANGELOG.md`).
- Một số test Phase 2 không còn đúng (điểm, thắng sớm, thời lượng Đêm) → đã cập nhật, ghi lý do
  trong `CHANGELOG.md` và comment `[P3]` ngay tại test.
- Bản chơi: thanh dầu trên đèn, nhấp nháy 1 Hz khi < 30, tia hút dầu giữa Bóng và đèn, HUD hiển thị
  `đang mang / sức chứa` và ngưỡng thắng.
