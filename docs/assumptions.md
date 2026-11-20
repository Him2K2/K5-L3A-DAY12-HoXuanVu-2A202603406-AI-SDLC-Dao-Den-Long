# Giả định

Số liệu Phase 1 tự chọn đã bị **thay hoàn toàn** bởi số chuẩn của TICKET-02 (Contract v1.1).
Nguồn sự thật: `src/core/config.js` (tuning), `src/core/maps.js` (bản đồ).

## Mô hình tick & vị trí (Contract)
- 60 tick/giây cố định. Snapshot tick 0 = sau khi dựng scenario, **trước** input.
- Bước k đọc input tick k, tạo trạng thái k+1; sự kiện trong bước đó ghi `tick = k+1`.
- `sim_tick` = số bước gameplay đã chạy (không tính tick tạm dừng).
  `time_left_s = startTimeLeft − sim_tick/60`.
- `player.pos` = chân, `shade.pos` = tâm, `lantern.pos` = chân cột, mote = điểm trên mặt đất.
- Góc trong bản đồ: `(x, z) = (r·cos a, r·sin a)`. Kiểm tra chéo: ticket đặt tầng 1 Đêm 3 ở
  nửa z > 0 và hai dốc ở 30°/150° — chỉ quy ước này đưa hai dốc lên đúng nửa z > 0.

## Phase 2 — các chỗ ticket để mở

### Bộ đếm & thứ tự trong tick
- Mọi bộ đếm (hồi chiêu, bất tử, choáng, bùa, TTL, hồi bùa, chờ hồi sinh, lướt…) giảm ở
  **bước 2** của tick, đúng thứ tự ticket. Hệ quả: đặt bất tử 90 ở tick k thì tick k+90 bị
  đánh lại được; hồi chiêu lướt 90 → lướt lại được ở tick k+90; choáng 120 → bóng đứng yên
  các tick k … k+119.
- **Recoil** áp bước lùi đầu tiên ngay trong tick gây hit (sau bước chạm), nên tổng 60 bước
  × (2/60) m = đúng 2 m. Đẩy lùi do Tỏa Sáng: 15 bước × (4/15) m = 4 m, bước đầu cùng tick pulse.

### Di chuyển
- **Tăng tốc tức thời** (0 s ≤ 0.1 s): vận tốc ngang = hướng × tốc độ ngay trong tick đó.
  Điều khiển trên không giống trên đất.
- Hướng quay mặt ban đầu +Z; cập nhật theo hướng input khi có input di chuyển.
- Lướt dùng hướng input nếu có, không thì hướng quay mặt. Đang lướt trên không: vy = 0, y giữ
  nguyên. Sau lướt, trọng lực áp lại từ vy = 0.
- Đang bị bục nhảy phóng: vận tốc ngang = vận tốc phóng (phím không ghi đè). Lướt vẫn được;
  lướt xong trở lại vận tốc phóng cho tới khi chạm đất.
- Bục nhảy kích hoạt khi Mây **đang đứng trên đất** và chân trong bán kính 1 m của bục
  (vận tốc phóng có hiệu lực từ tick sau).
- Gió (Đêm 3) cộng thêm 2 m/s theo hướng gió vào vận tốc ngang, kể cả khi lướt/bay.
- **Va chạm địa hình:** di chuyển ngang bị chặn nếu mặt đất ở vị trí mới cao hơn chân
  Mây + 0.3 m (đang đứng) hoặc + 0 m (đang bay). Thử trượt theo từng trục. Đang đứng mà mặt đất
  thấp đi ≤ 0.3 m thì bám đất (đi xuống dốc), thấp hơn thế thì rơi.
- Tháp chuông được mô hình là "mặt đất" cao 14 m trong r ≤ 2 → không thể đi vào/leo lên.

### Điểm xuất phát
- Đêm 1, 2: (0,0,0). **Đêm 3: (0,0,−30)** vì (0,0,0) nằm trong tháp chuông. Hồi sinh sau khi rơi
  về đúng điểm xuất phát của Đêm.

### Đom đóm
- Trần 30 tính trên **tổng đom đóm đang có trên sân** (cả loại rơi). Một điểm sinh là "trống"
  khi không có đom đóm `random` nào đang ở điểm đó.
- 20 đom đóm ban đầu chọn ngẫu nhiên (theo seed) trong các điểm sinh của Đêm.
- Đom đóm rơi khi bị đánh: phân bố đều quanh vòng tròn, góc lệch đầu và bán kính 1.5–2.5 m
  lấy theo seed; độ cao = mặt đất tại điểm đó (nếu là biển mây thì lấy độ cao chân Mây).
- `motes[].ttl_s` = `null` với loại `random`.

### Bóng Mực
- Tâm bóng ở độ cao **mặt đất + 1.0 m** (cập nhật khi di chuyển). Vị trí trong scenario được
  giữ nguyên ở snapshot tick 0.
- Chênh cao khi chạm = |y chân Mây − y tâm Bóng|.
- Khoảng cách phát hiện/bỏ đuổi đo theo XZ.
- `spawning` kéo dài 30 tick (không di chuyển, không gây hit, vẫn bị Tỏa Sáng trúng).
- `wander`: lượn 1.5 m/s quanh điểm "nhà" (bán kính 5 m), điểm đích lấy theo PRNG riêng của
  từng con (seed + id) để không làm xáo trộn chuỗi ngẫu nhiên chung.
- Hết choáng / hết recoil: còn trong 18 m → `chase`, ngoài → `wander`.
- Bóng bay lơ lửng: **không** bị vách tầng chặn, nhưng **bị chặn** bởi biển mây, tháp chuông,
  và vùng an toàn của đèn đã sáng. Đẩy lùi gặp các vật cản này thì dừng.
- Bóng trong scenario không ghi `state` được khởi tạo `chase` nếu trong 12 m, ngược lại `wander`.
- Bóng không bao giờ chết; "tối đa N" tính theo tổng số đã sinh.
- Điểm sinh hợp lệ: cách Mây ≥ 15 m (XZ). Chọn ngẫu nhiên theo seed trong các điểm hợp lệ.

### Gió Lạc
- Điểm sương = các điểm sinh Bóng Mực của Đêm. Bay lơ lửng ở mặt đất + 1.2 m.
- "Tối đa 2 con" tính theo số con chưa `removed`. Con đã `removed` vẫn nằm trong mảng
  `drifters` với `state: "removed"`.
- Chạm cướp áp dụng cho con ở `idle` hoặc `chase` chưa từng cướp, khi Mây đang mang > 0.
- Tỏa Sáng xét Gió Lạc theo cùng luật khoảng cách 3D ≤ 5 m.
- Sự kiện `pulse.stunned_ids` chỉ liệt kê Bóng Mực.

### Gió mạnh (Đêm 3)
- Cơn gió bắt đầu ở sim_tick 1800, 3600, … kéo dài 300 tick. Hướng lấy từ PRNG chung lúc bắt
  đầu cơn. Báo trước 120 tick chỉ là hiệu ứng (lá bay + âm thanh), không ảnh hưởng logic.
- `wind_enabled` mặc định `true` ở Đêm 3, `false` ở Đêm 1, 2.

### Điểm & kết thúc
- `score` trong snapshot/end là điểm **của Đêm đang chạy** (cộng dồn kể cả khi thua). Bản chơi
  hiển thị tổng các Đêm đã thắng theo ticket.
- `night_start` được ghi ở **tick 0**, ngay sau snapshot tick 0.
- `player.invuln` trong snapshot là **số giây** bất tử còn lại (0 = không bất tử).
- Nếu chạy xong `--ticks` khi đang tạm dừng, dòng `end` ghi `state: "paused"`.
