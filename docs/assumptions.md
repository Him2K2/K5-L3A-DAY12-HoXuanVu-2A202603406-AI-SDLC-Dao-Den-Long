# Giả định (chỗ PRD-0 / Contract để mở)

PRD-0 cố ý tổng quát. Dưới đây là các giả định đã chốt; mọi con số khớp với
`game.contract.json` và `src/core/config.js`.

## Mô hình tick & vị trí (theo Contract, nêu lại để rõ)
- 60 tick/giây cố định, `DT = 1/60`. Snapshot tick 0 = sau khi dựng scenario, **trước** input.
- Bước k (k = 0…N−1) đọc input tick k, tạo trạng thái k+1; sự kiện trong bước ghi `tick = k+1`.
- `time_left_s = startTimeLeft − (số bước đã chạy)/60`, với `startTimeLeft` = `scenario.time_left_s`
  nếu có, ngược lại `night1_duration_s`.
- `player.pos` = chân, `shade.pos` = tâm, `lantern.pos` = chân cột, mote = điểm trên mặt đất.
  Mọi khoảng cách đo ở mặt phẳng **XZ**; "trong bán kính r" nghĩa là **≤ r**.

## Luật chơi
- **Thắp đèn:** mỗi đèn cần `lantern_cost = 5` đom đóm. Khi `interact` (chuyển false→true)
  và đứng trong `interact_radius = 2.5` của một đèn **chưa thắp**, nạp
  `min(carried, cost − deposited)` vào đèn **gần nhất**. Đủ `cost` → `lantern_lit` (+100).
- **Nhặt đom đóm:** tự động khi ở trong `pickup_radius = 1.5` và `carried < carry_capacity = 5`;
  xét theo thứ tự danh sách mote (tất định).
- **Tỏa sáng (pulse):** edge-trigger, chỉ khi hết hồi chiêu (`pulse_cooldown_s = 3`). Làm choáng
  (`pulse_stun_s = 2`) và đẩy lùi (`pulse_push_m = 3`) mọi Bóng Mực trong `pulse_radius = 6`,
  tốn `pulse_cost = 1` đom đóm (chặn ở 0). **Luôn phát sự kiện `pulse`** khi hết hồi chiêu
  (kể cả `stunned_ids` rỗng) để test ổn định; không yêu cầu đủ đom đóm mới pulse được.
- **Bị chạm:** Bóng Mực (không bị choáng) trong `shade_hit_radius = 1.2` → mất 1 mạng,
  bất tử `invuln_s = 1.0`, rơi `floor(carried × hit_drop_ratio)` = `floor(carried × 0.5)`
  đom đóm (đã tiêu mất, không respawn). Tối đa 1 lần chạm/tick nhờ bất tử.
- **Mạng:** bắt đầu `flames = 3`. Hết mạng → `game_over(lost, no_flames)`.
- **Thắng:** cả 5 đèn sáng → `game_over(won, all_lit)`, cộng thưởng thời gian + mạng.
- **Hết giờ (dawn):** `time_left_s ≤ 0` mà chưa thắng → `game_over(lost, dawn)`.

## Các lựa chọn cần nêu rõ
- **`safe_radius` áp cho MỌI đèn** (cả chưa thắp), theo nghĩa đen "bán kính quanh đèn mà
  Bóng Mực không vào được" — tạo nơi trú ẩn. Hành vi tất định: sau khi di chuyển, Bóng Mực
  lọt vào vùng cấm bị đẩy ra đúng biên `safe_radius`.
- **`fall_enabled = false`:** đảo là đĩa tròn bán kính 40 m, player bị kẹp trong biên, không
  có rơi khỏi đảo nên **không phát** sự kiện `player_hit` với `by:"fall"`.
- **Nhảy** là chuyển động trục Y (có trọng lực, tất định) nhưng chỉ mang tính biểu diễn:
  mọi luật đo ở XZ nên nhảy không đổi nhặt/thắp/bị chạm. (Không có trường `jump` trong tuning.)
- **Sinh ngẫu nhiên ở Đêm mặc định** (khi `random_motes`/`random_shades` ≠ false): rải
  `MOTE_SCATTER_COUNT = 40` đom đóm theo seed; cứ `SHADE_SPAWN_INTERVAL_S = 12` giây sinh
  thêm 1 Bóng Mực ở vành đảo, tối đa `SHADE_MAX = 6`, kèm sự kiện `shade_spawned`. Khi test
  đặt `random_*: false` thì **tắt hoàn toàn** phần sinh này (giữ output headless ổn định).
- **`night1_duration_s = 180`** làm mặc định; test thường tự đặt `time_left_s` trong scenario.
- **Trạng thái Bóng Mực** dùng `chase` và `stunned` (Contract yêu cầu tối thiểu có `stunned`).
- Mảng `motes` trong snapshot (id + pos) được xuất đầy đủ (khuyến nghị ở v1.0).

## Vị trí 5 Đèn Lồng (Đêm 1, cố định)
Hình ngũ giác bán kính 25 m; `L1` đặt tại `[0,0,25]` cho khớp ví dụ scenario trong Contract.
`L2..L5` lần lượt ở 162°, 234°, 306°, 18°.
