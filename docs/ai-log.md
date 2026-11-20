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

## Mẫu cho các phase sau
- Ticket nhận: …
- Giả định mới: …
- Test thêm: …
- Lỗi AI gặp: …
- Token/chi phí: …
