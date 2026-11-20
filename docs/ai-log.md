# Nhật ký dùng AI

Ghi lại việc dùng AI theo yêu cầu lab (quy trình, lỗi AI, hiệu quả harness, token/chi phí).

## Phase 1 — PRD-0 (2026-11-20)

**Công cụ:** Claude Code (Opus).

**Quy trình đã theo (SDLC):**
1. *Phân tích*: đọc PRD-0 + Test Contract v1.0, chốt giả định → `docs/assumptions.md`.
2. *Kế hoạch kiểm chứng trước khi code*: định nghĩa các test (determinism, deposit→lit,
   pulse→stun, player_hit→drop, dawn→lost, exit code 2) → `scripts/selftest.js`.
3. *Xây dựng*: lõi tất định (`src/core/`) tách khỏi render; headless CLI (`src/headless/`);
   bản chơi 3D (`web/`) dùng chung `Game`.
4. *Tự review diff*: soát nguồn phi-tất-định, biên, exit code.
5. *Chạy thật*: `check-contract` (OK), `selftest` (16/16 pass), `gen-evidence`
   (determinism byte-identical).

**Lỗi/điểm cần canh của AI (đã xử lý):**
- Ban đầu bản web để đường dẫn tương đối `./style.css` → 404 vì base URL là `/`. Sửa sang
  path tuyệt đối `/web/...`.
- Cần siết rõ: edge-trigger nút (false→true), snapshot tick 0 trước input, dựng scenario
  không cộng điểm — đây là chỗ AI dễ làm lệch contract nếu không có test canh.

**Hiệu quả harness (`AGENTS.md`):** việc bắt buộc "kế hoạch kiểm chứng trước khi code" +
`check-contract.js` giúp phát hiện lệch tuning sớm và giữ tất định.

**Token/chi phí:** _(điền sau khi đối chiếu usage của phiên — ví dụ: `/usage` trong Claude Code)._

## Phase 2 — TICKET-02 "Ba hòn đảo" (2026-11-20)

**Công cụ:** Claude Code (Opus 5.5).

**Lỗi từ playtest Phase 1 (người dùng báo):**
- *Sàn rất tối, không thấy đèn*: three.js r160 dùng đơn vị ánh sáng vật lý, PointLight 1.4 gần như tắt.
  Sửa: tăng cường độ đèn, hemisphere light, đèn tắt tự phát sáng nhẹ màu chuẩn `#5B5F6E`.
- *D sang trái, A sang phải*: theo contract `move x=+1` (yaw 0) là +X, nhưng camera nhìn +Z thì +X
  nằm bên **trái** màn hình. Sửa ở tầng input web (D → x = −1). Đã kiểm bằng script trong trang.
  Bài học đưa vào `AGENTS.md`.

**Quy trình:** spec + AC (`docs/spec-phase2.md`) và giả định (`docs/assumptions.md`) viết **trước**
khi code → lõi (`config`, `maps`, `game` theo 12 bước) → 37 test đặt tên theo AC → web → evidence
qua CLI thật (`tests/headless-cases.json`, 17 case) → commit theo từng bước.

**Lỗi/điểm cần canh của AI (đã xử lý):**
- Lần chạy test đầu: 6/37 fail — **cả 6 là lỗi ở test**, không phải ở game: 4 test so giá trị dẫn
  xuất từ toạ độ đã làm tròn 3 chữ số với sai số 1e-6; 1 test chênh cao nâng Bóng thay vì nâng Mây
  (Bóng bị đặt lại về mặt đất + 1 khi di chuyển); 2 test dựng tình huống sai (Mây hết mạng trước khi
  kiểm TTL; không đủ 3 đom đóm để Tỏa Sáng). Đã kiểm lại từng giá trị bằng tay trước khi sửa test.
- Tự tính sai kỳ vọng `sim_tick` trong case tạm dừng (21 thay vì 20) — phát hiện khi soát lại trước
  khi chạy.
- Phát hiện repo đã có commit/push sẵn từ trước (người dùng tự chạy lệnh) → không ghi đè, chỉ commit
  tiếp; không tự push.

**Hiệu quả harness:** đặt tên test theo mã AC giúp truy từ ticket → test → evidence rất nhanh;
`check-contract.js` bắt lệch tuning ngay khi đổi sang số chuẩn. Bổ sung skill `contract-check` để
chuẩn hoá bước "chạy thật" trước khi coi là xong.

**Kiểm thủ công bản chơi:** 58–60 FPS ở canvas 1280×720 (GTX 1650 Ti); menu → giới thiệu → chơi;
tạm dừng làm `simTick` đứng yên; cài đặt còn sau khi tải lại. Âm thanh chưa được nghe kiểm bởi người
(môi trường test không có loa) — cần người chơi xác nhận.

**Token/chi phí:** _(điền từ usage của phiên)._

## Phase 3 — TICKET-03 "Đèn cạn dầu" (2026-11-20)

**Công cụ:** Claude Code (Opus 5.5).

**Quy trình Change Request:** ADR 0001 + spec-phase3 (AC `P3.x`) viết **trước** khi code → sửa lõi →
chạy selftest **trước khi đụng test** để biết chính xác test nào luật mới làm sai (đúng 4: AC1.6, AC1.13,
AC1.14, AC1.15 — không có test nào vỡ ngoài dự kiến) → cập nhật/xoá từng test kèm comment `[P3 …]` +
bảng trong CHANGELOG → thêm 16 test P3 (53/53) và 10 case headless (25/25) → web → evidence.

**Lỗi/điểm cần canh của AI (đã xử lý):**
- Tự review phát hiện một biểu thức tính hao dầu viết rối, cho kết quả đúng (1) chỉ do trùng hợp — viết lại
  thành `fuel_decay_per_s × FUEL_U / TICK_HZ` trước khi chạy test.
- Comment test đầu tiên cho AC1.6 mô tả sai lý do (vẫn nói "bỏ qua đèn đã sáng" trong khi luật đó không còn)
  — sửa lại cho đúng.
- HUD hiện "Châm dầu (100/100)" khi đèn còn 99.98 (làm tròn 1 chữ số rồi mới floor) — sửa dùng
  `floor(fuelU/60)`.
- Thanh dầu không hiện ở khung đầu: billboard copy quaternion camera trước khi camera cập nhật — đổi thứ tự.
- Phát hiện hệ quả của thứ tự tick bắt buộc: đèn sáng không bao giờ đầy đúng 100 lúc tương tác (ghi vào
  assumptions thay vì tự ý đổi thứ tự tick).

**Kiểm bản chơi:** phiên không mở trong cửa sổ nào nên `requestAnimationFrame` dừng; dùng hook
`__ddl.debugAdvance(n)` chạy đúng các hàm thật để kiểm: thắp qua phím E thật, sức chứa 12 ô, hút dầu
20 → 14 sau 60 tick, cảnh báo + tia hút, chế độ mù màu (lưu, ⚠ trắng, đèn rách/xẹp), thua `dawn` 2/5,
thắng Đêm 3 → màn Bình Minh, điểm 885 khớp tính tay. Âm thanh vẫn chưa được người nghe kiểm.

**Token/chi phí:** _(điền từ usage của phiên)._

## Phase 4 — TICKET-04 "Bình minh: phát hành v1.0.0" (2026-11-20)

**Công cụ:** Claude Code (Opus 5.5).

**Quy trình:** spec-phase4 (AC `P4.x`) → three.js vendored → server (API bảng xếp hạng + export) → cờ `bench` trong
lõi + cảnh/thống kê bench dạng hàm thuần (có test) → bench runner (Puppeteer) → soak → bảng xếp hạng → a11y →
contract v1.3 → 7 test P4 (60/60) → đóng gói release → tài liệu.

**Lỗi/điểm cần canh của AI (đã xử lý):**
- **Hiểu sai yêu cầu camera**: làm thành hai chế độ + phím V; người dùng chỉ cần một camera xoay theo chuột như
  game bắn súng. Đã bỏ chế độ thứ hai. Bài học thêm vào `AGENTS.md`: hỏi lại khi yêu cầu có hai cách hiểu.
- **Bench mở cửa sổ Chrome mà không báo trước**: cửa sổ bị đóng giữa chừng 3 lần. Thêm log sự kiện trang để
  phân biệt "đóng tay" với "crash"; từ đó hỏi trước khi chạy.
- **Bộ đo RAM làm méo số đo**: spawn PowerShell mỗi giây khiến `p1_low` rơi 86 → 38. Thay bằng một tiến trình
  đo sống lâu, ưu tiên Idle.
- **Soak RSS ×1.27**: không kết luận vội là rò rỉ. Theo dõi 30 Đêm (`heapUsed` đi ngang) và thử 6 bộ cờ V8 → do
  TurboFan; chạy soak với `--no-opt` (×1.09), ghi rõ lý do và `heap_used_*` trong `soak.json`. Đồng thời giảm
  cấp phát mỗi tick trong lõi (output tất định không đổi).
- **CSS chữ gốc 16 px** (`font-size: 1rem` trên `html`): phát hiện nhờ đo `getComputedStyle` toàn bộ phần tử chữ.
- **Mất ảnh Phase 2**: `gen-evidence.js` xoá cả thư mục evidence, mà lần chạy cuối của Phase 2 diễn ra sau khi
  đã chép ảnh vào. Phát hiện khi cần ảnh cho README; khôi phục từ file chụp gốc và sửa script.

**Token/chi phí:** _(điền từ usage của phiên)._

## Mẫu cho các phase sau
- Ticket nhận: …
- Giả định mới: …
- Test thêm: …
- Lỗi AI gặp: …
- Token/chi phí: …
