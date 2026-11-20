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

## Mẫu cho các phase sau
- Ticket nhận: …
- Giả định mới: …
- Test thêm: …
- Lỗi AI gặp: …
- Token/chi phí: …
