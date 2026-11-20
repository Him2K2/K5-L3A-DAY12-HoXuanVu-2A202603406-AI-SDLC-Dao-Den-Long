# Spec Phase 4 — TICKET-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Viết trước khi code. Mỗi AC ↔ test `P4.x` trong `scripts/selftest.js`, hoặc bằng chứng trong `evidence/phase4/`.

## Quyết định kỹ thuật
- **Bench cho bản web**: `scripts/bench.js` tự bật static server, dùng **Puppeteer** mở Chrome **có cửa sổ**
  (không headless) viewport 1280×720, tắt vsync bằng `--disable-gpu-vsync --disable-frame-rate-limit`, tắt
  throttle nền. Trang `/?bench=1` chạy cảnh chuẩn và tự đo `dt` từng khung; Node lấy kết quả, đo **RSS cả cây
  tiến trình Chrome** (ps / Win32_Process) và ghi `bench.json`. Puppeteer là *optionalDependency*.
- **Bảng xếp hạng**: server Node lưu `data/leaderboard.json` (API `/api/leaderboard`); `node server.js
  --export-leaderboard out.json` đọc file đó. Bản web tĩnh (Release) không có server → lưu `localStorage`.
- **three.js vendored** ở `web/vendor/` (MIT) → chạy offline, Release tĩnh tự đủ.
- `run_cmd = node server.js` (tự mở trình duyệt; `--no-open` để tắt).

## AC
| AC | Tiêu chí | Kiểm chứng |
|----|----------|-----------|
| P4.1 | Cảnh bench: Đêm 1, đúng **200** Bóng `wander` rải đều trên đảo (seed 42), đúng **100** đom đóm, L1–L3 sáng fuel 100; Mây đứng yên (0,0,0) | test `P4.1` (cảnh dựng bằng hàm thuần `buildBenchScenario`) |
| P4.2 | Trong bench tắt: sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng vẫn di chuyển theo wander | test `P4.2` (chạy 30 s mô phỏng) |
| P4.3 | Camera: tròn tâm O, r = 30, Y = 15, nhìn O, bắt đầu (30,15,0), ngược chiều kim đồng hồ (cùng quy ước góc của ticket), 15 s/vòng | test `P4.3` (`benchCamera(t)`) |
| P4.4 | 3 s khởi động không đo, đo đúng `--duration` s, thoát mã 0; `bench.json` đủ trường | chạy thật → `bench.json` |
| P4.5 | Công thức `avg_fps`, `p1_low_fps` (k = max(1, ceil(0.01N)) dt lớn nhất), `frame_ms_p95` | test `P4.5` (`benchStats`) |
| P4.6 | Soak: 10 Đêm một tiến trình, Đêm i dùng seed 7 + i, xoay 1→2→3, input ngẫu nhiên theo seed (30 tick đổi hướng; 5/3/2/10 %); `crashes = 0`, `mem_end ≤ 1.2 × mem_start` | chạy thật → `soak.json`; test `P4.6` (input tất định) |
| P4.7 | Bảng xếp hạng: tên 3–12 `[A-Za-z0-9_]` (+ tiếng Việt có dấu), mục {name, score, nights_won, achieved_at ISO có múi giờ, seed}; top 10; điểm giảm dần, bằng điểm ai trước đứng trên | test `P4.7` |
| P4.8 | Lưu đĩa, còn sau khi tắt/mở; `--export-leaderboard out.json` → `{"entries":[…]}` đúng thứ tự; màn hình Bảng xếp hạng từ menu | test `P4.8` (CLI) + thủ công |
| P4.9 | Đổi phím mọi hành động, báo trùng phím, nút khôi phục mặc định, được lưu | thủ công / script trang |
| P4.10 | Chỉ báo hình ảnh: Bóng xuất hiện (+ mũi tên mép màn hình), gió sắp thổi, 10 s cuối, đèn fuel < 30 | script trang + ảnh |
| P4.11 | Giảm chuyển động: tắt rung camera + chớp màn hình | script trang |
| P4.12 | Chữ UI ≥ 18 px ở 1280×720; tuỳ chọn chữ lớn ×1.25 | script trang (đo `getComputedStyle`) |
| P4.13 | Clone sạch → ≤ 3 lệnh → chơi được; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE | kiểm clone sạch |
| P4.14 | Contract v1.3 có `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên (regression) | `check-contract` + selftest |
