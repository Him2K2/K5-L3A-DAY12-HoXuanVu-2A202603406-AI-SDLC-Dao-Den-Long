# Kiểm tra Phase 4 (ngoài selftest / headless)

Mọi kiểm tra dưới đây chạy thật: script trong trang (browser pane của Claude desktop app, Chrome/ANGLE,
GTX 1650 Ti) hoặc lệnh shell. Chỗ nào dựng cảnh bằng hook debug `window.__ddl` đều được ghi rõ.

## Benchmark (`scripts/bench.js`)
| Lần chạy | Kết quả | Ghi chú |
|----------|---------|---------|
| Chạy thử 3 s (bộ đo RAM cũ: PowerShell mỗi 1 s) | avg 150.2 · **p1_low 13.9** · p95 9.0 · load 3412 ms · RAM 482 MB | `p1_low` dưới ngưỡng ⇒ điều tra |
| 8 s, bộ đo RAM cũ / tắt đo RAM | **p1_low 38.0** / **86.5** (avg 136.9 / 167.5) | Bộ đo RAM gây khựng ⇒ thay bằng tiến trình đo sống lâu, ưu tiên Idle, mỗi 2 s |
| 3 lần bị gián đoạn | "Target closed", "detached Frame", "Execution context destroyed" | Log sự kiện: `page closed` → `browser disconnected`, **không crash** ⇒ cửa sổ bị đóng tay |
| Chạy chính thức 30 s | xem [`../../bench.json`](../../bench.json) | chạy sau khi đã báo người dùng không đóng cửa sổ |

Vsync tắt bằng `--disable-gpu-vsync --disable-frame-rate-limit` (avg > 60 FPS xác nhận không bị khoá theo màn hình).

## Soak (`scripts/soak.js`)
| Cấu hình V8 | mem_start → mem_end (MB) | Tỉ lệ | Thời gian |
|-------------|--------------------------|-------|-----------|
| mặc định | 34.2 → 43.1 | 1.26 | 0.3 s |
| `--max-semi-space-size=1` | 34.1 → 41.8 | 1.23 | 0.3 s |
| `--single-threaded` | 37.0 → 42.4 | 1.15 | 0.8 s |
| **`--no-opt` (soak_cmd)** | 34.2 → 37.3 | **1.09** | 0.3 s |
| `--no-opt --no-maglev` | 33.9 → 35.6 | 1.05 | 0.7 s |
| `--jitless` | 31.0 → 32.6 | 1.05 | 1.2 s |

Theo dõi 30 Đêm (cờ mặc định): `heapUsed` 3.4 → 3.8 → 4.0 MB (đi ngang); RSS nhảy +7 MB **sau Đêm 1** rồi đi
ngang 41–45 MB ⇒ chi phí khởi động một lần của TurboFan, không phải rò rỉ. Kết quả chính thức: [`soak.json`](soak.json)
(0 crash, ×1.091, `heap_used` 3.44 → 3.86 MB).

## Bảng xếp hạng
- Thua (debug: rút ngắn Đêm) → hiện ô nhập tên. "ab" bị từ chối kèm thông báo; "Mây_đêm1" (tiếng Việt có dấu) được
  lưu → màn Bảng xếp hạng "Bạn đứng hạng #1!", "Lưu trên đĩa (data/leaderboard.json)".
- `data/leaderboard.json` có `achieved_at: "2026-11-20T16:43:00+07:00"` (ISO 8601 + múi giờ).
- `node server.js --export-leaderboard out.json` → `{"entries":[…]}`, exit 0. Test `P4.8` kiểm thứ tự / top 10 / loại dòng sai.
- (Mục thử nghiệm đã được xoá khỏi `data/` sau khi kiểm.)

## Dễ tiếp cận
| Kiểm tra | Kết quả |
|----------|---------|
| Cỡ chữ nhỏ nhất (đo `getComputedStyle` mọi phần tử có chữ) | menu / cài đặt / HUD: **18 px**; chữ lớn: **22.5 px** (×1.25) |
| Lỗi tìm thấy | Lần đo đầu: 16 px — `html, body { font-size: 1rem }` đè `html { 18px }`; đã sửa |
| Đổi phím Nhảy → E (đang là Tương tác) | Bị từ chối: "⚠ Phím E đang dùng cho 'Tương tác (thắp / châm dầu)'…" |
| Đổi phím Nhảy → J | Lưu vào `localStorage` (`keys.jump = "KeyJ"`); "Khôi phục mặc định" → `Space` |
| Gán phím dành riêng (Esc / ◀ ▶) | Bị từ chối kèm thông báo |
| Lịch sinh thật ở sim tick 300 (debug: nhảy `simTick` tới 299) | 2 phụ đề "👁 Bóng Mực xuất hiện" + 2 mũi tên mép màn hình |
| Bị đánh, giảm chuyển động BẬT | rung camera 0, không chớp màn hình |
| Bị đánh, giảm chuyển động TẮT | rung 0.3 s, lớp chớp `flash-hit` |

## Camera & bản phát hành
- Một camera duy nhất: chuột phải 300 px / lên 100 px → yaw −45°, pitch +15°; phím V không còn tác dụng; có tâm ngắm.
- `dist/dao-den-long-web-v1.0.0/` chạy bằng chính `server.js` bên trong: `/`, `/web/main.js`,
  `/web/vendor/three.module.js`, `/src/core/game.js`, `/src/leaderboard.js`, `/src/bench/scene.js`,
  `/api/leaderboard` đều 200.
