# Spec Phase 2 — TICKET-02 "Ba hòn đảo" (Contract v1.1)

Tài liệu này là spec + acceptance criteria (AC) + kế hoạch kiểm chứng, viết **trước khi code**.
Mỗi AC có mã `ACx.y`; cột "Kiểm chứng" chỉ ra test trong `scripts/selftest.js` (tên test bắt
đầu bằng mã AC) hoặc bằng chứng thủ công trong `evidence/phase2/`.

Số liệu chuẩn (Phần 1) và bản đồ chuẩn (Phần 2) được mã hoá **một chỗ duy nhất**:
`src/core/config.js` (tuning + hằng số) và `src/core/maps.js` (3 Đêm).
Các chỗ ticket để mở được chốt trong [`assumptions.md`](assumptions.md) mục "Phase 2".

## A. Số liệu & thứ tự tick (Phần 1)

| AC | Tiêu chí | Kiểm chứng |
|----|----------|-----------|
| AC1.1 | Chạy 6.0 m/s: giữ `move [0,1]` 60 tick → z = 6.0 (đạt tốc độ ngay, ≤ 0.1 s) | test `AC1.1` |
| AC1.2 | Nhảy: vy=7, g=−20, chỉ khi chạm đất; tiếp đất lại y=0 | test `AC1.2` |
| AC1.3 | Lướt: 14 m/s × 12 tick = 2.8 m; hồi chiêu 90 tick tính từ lúc bắt đầu; lướt trên không giữ độ cao; sự kiện `dash` | test `AC1.3` |
| AC1.4 | Nhặt: XZ ≤ 1.0 và chênh cao ≤ 1.5; sức chứa 10 | test `AC1.4` |
| AC1.5 | Đom đóm: 20 lúc đầu ở 20 điểm khác nhau; +1 mỗi 240 tick tại điểm trống, trần 30 | test `AC1.5` |
| AC1.6 | Nạp đèn: bán kính 2.0, min(mang, thiếu), đèn gần nhất / id nhỏ hơn, nhớ tiến độ; +10/đom đóm nạp, +100/đèn | test `AC1.6` |
| AC1.7 | Vùng an toàn 6 m chỉ ở đèn đã sáng; bóng ở trong lúc thắp bị đẩy ra ≤ 30 tick, không gây sát thương lúc đó | test `AC1.7` |
| AC1.8 | Tỏa Sáng: cần ≥ 3 đom đóm, tâm chân+0.8, 3D ≤ 5 m, choáng 120 tick, đẩy 4 m trong 15 tick, pulse lại làm mới; +5/con | test `AC1.8` |
| AC1.9 | Bóng Mực: phát hiện 12 m, bỏ đuổi 18 m, chạm XZ ≤ 1.0 & chênh cao ≤ 1.5, recoil 2 m / 60 tick, tối đa 1 hit/tick theo id tăng dần | test `AC1.9` |
| AC1.10 | Lịch sinh: 2 con ở tick 300, rồi mỗi khoảng (480/420/360), tối đa 6/8/10, cách người chơi ≥ 15 m, id S1, S2… | test `AC1.10` |
| AC1.11 | Bị đánh: −1 lửa, rơi floor(mang/2) ra vành 1.5–2.5 m, TTL 480, bất tử 90 | test `AC1.11` |
| AC1.12 | Rơi (Y < −10): đúng 1 lần, bỏ qua bất tử, mất hết đom đóm (`lost`), chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 | test `AC1.12` |
| AC1.13 | Thắng/thua xét sau mỗi tick theo thứ tự no_flames → all_lit → dawn | test `AC1.13` |
| AC1.14 | Điểm thắng: + floor(giây còn) × 2 + 50 × lửa | test `AC1.14` |
| AC1.15 | Tạm dừng: tick tăng, sim_tick/thời gian/hồi chiêu/spawn/TTL đứng yên, snapshot `paused`, sự kiện `paused`/`resumed` | test `AC1.15` |

## B. Bản đồ (Phần 2)

| AC | Tiêu chí | Kiểm chứng |
|----|----------|-----------|
| AC2.1 | Đêm 1: đảo r=40, đèn đúng toạ độ ticket, đi ra ngoài 40 m thì rơi | test `AC2.1` |
| AC2.2 | Đêm 2: 2 đảo r=28 + cầu tre x∈[26,44] z∈[−2,2]; bục nhảy bắn sang đảo kia, đáp trong đảo đích | test `AC2.2` |
| AC2.3 | Đêm 3: 3 tầng, vách đứng không leo được, 2 dốc 30°/150°, bục nhảy lên tầng 2, tháp chuông chặn | test `AC2.3` |
| AC2.4 | Gió mạnh Đêm 3: mỗi 30 s, kéo dài 5 s, 2 m/s, hướng ngẫu nhiên theo seed; `wind` trong snapshot | test `AC2.4` |

## C. Tính năng mới (Phần 3)

### C1. Gió Lạc (Đêm 2, 3)
- **AC3.1** Sinh tại tick 1200, 2400, … ở điểm sương ngẫu nhiên, tối đa 2 con còn sống, id D1, D2, …
- **AC3.2** `idle` (2 m/s) → `chase` (7 m/s) khi Mây mang ≥ 5 và cách ≤ 15 m; điều kiện mất thì về `idle`.
- **AC3.3** Chạm XZ ≤ 1.2: cướp min(3, mang) → `flee` 240 tick rồi `removed`; mỗi con cướp 1 lần; bất tử không chặn; vùng an toàn không chặn; không mất lửa. Sự kiện `drifter_steal`.
- **AC3.4** Tỏa Sáng trúng con `chase` → `flee` không cướp; trúng con `flee` đang giữ đồ → thả hết thành đom đóm rơi, biến mất sau 120 tick. Sự kiện `drifter_drop`.
- Kiểm chứng: tests `AC3.1`–`AC3.4`.

### C2. Bùa Gió
- **AC3.5** Nhặt như đom đóm; hiệu lực 600 tick (nhặt lại làm mới); chạy 7.2 m/s; lướt không hồi chiêu (vẫn phải nhấn lại; nhấn khi đang lướt bị bỏ qua). Sự kiện `charm_picked`.
- **AC3.6** Bùa xuất hiện lại sau 2700 tick; vị trí Đêm 2 (35,0,0), Đêm 3 (30,0,25) & (−30,0,25).
- Kiểm chứng: tests `AC3.5`, `AC3.6`.

### C3. Chuỗi 3 Đêm (bản chơi)
- **AC3.7** Menu chính → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế. Thắng Đêm 3 → màn Bình Minh + tổng điểm (tổng các Đêm đã thắng). Thua → chơi lại Đêm đó.
- Kiểm chứng: thủ công, ảnh chụp trong `evidence/phase2/`.

### C4. Tạm dừng
- **AC3.8** Esc/P dừng hoàn toàn logic; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu.
- Kiểm chứng: headless `AC1.15` (logic dừng) + ảnh chụp menu.

### C5. Cài đặt
- **AC3.9** Âm lượng + độ nhạy chuột, lưu `localStorage`, còn sau khi tải lại trang.
- Kiểm chứng: thủ công (đổi → reload → giá trị giữ nguyên).

### C6. Âm thanh
- **AC3.10** Nhạc nền đêm + SFX: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối. Tổng hợp bằng WebAudio (không asset ngoài).
- Kiểm chứng: thủ công + bảng ánh xạ sự kiện→âm trong `web/audio.js`.

### C7. HUD đầy đủ
- **AC3.11** Lửa (trên trái); đồng hồ mm:ss (trên giữa, đỏ + nhấp nháy khi ≤ 30 s); đèn k/n + điểm (trên phải); thanh đom đóm 10 ô (dưới giữa); icon hồi chiêu Lướt & Tỏa Sáng (dưới phải); nhắc "E — Nạp ánh sáng (x/10)" gần đèn; mũi tên chỉ đèn chưa sáng gần nhất khi ở ngoài màn hình.
- Kiểm chứng: ảnh chụp.

### C8. Bảng màu & ánh sáng
- **AC3.12** Các thành phần liệt kê dùng đúng hex ticket (lệch ≤ 10%/kênh) — hằng số tập trung ở `web/palette.js`.
- **AC3.13** Cường độ ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn).
- Kiểm chứng: đọc `web/palette.js` + ảnh chụp trước/sau thắp đèn.

## D. Contract v1.1

| AC | Tiêu chí | Kiểm chứng |
|----|----------|-----------|
| AC4.1 | `contract_version "1.1"`, tuning = số chuẩn + 5 khoá dash/night2/night3 | `check-contract.js` |
| AC4.2 | `--night 1|2|3` | test `AC4.2` |
| AC4.3 | Snapshot có `night`, `wind`, player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}, mảng motes/drifters/charms | test `AC4.3` |
| AC4.4 | Scenario nhận các trường mới (invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks, shades[].state/state_ticks_left, drifters, charms, random_drifters, wind_enabled) | tests `AC3.x`, `AC4.4` |
| AC4.5 | Trạng thái Bóng Mực ∈ {spawning, wander, chase, recoil, stunned} | test `AC4.5` |
| AC4.6 | Một Đêm đầy đủ 21 600 tick chạy ≤ 30 s | test `AC4.6` (đo thời gian) |
| AC4.7 | Regression: tất định, exit code 2, các luật Phase 1 vẫn đúng với số chuẩn | tests `R*` |
