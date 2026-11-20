# CREDITS

## Mã nguồn
- Toàn bộ mã lõi, headless, web, script và tài liệu do tác giả làm với sự hỗ trợ của AI (xem mục "Công cụ AI").

## Thư viện & công cụ bên thứ ba
| Thành phần | Dùng cho | Giấy phép |
|------------|----------|-----------|
| **three.js** r160 (`web/vendor/three.module.js`, kèm `web/vendor/LICENSE-three.txt`) | Render 3D bản chơi | MIT |
| **Puppeteer** 22.15.0 + Chrome for Testing (optionalDependency, không đóng gói vào repo) | Chạy benchmark trong cửa sổ Chrome thật | Apache-2.0 (Puppeteer), BSD-style (Chromium) |
| Node.js | Chạy lõi/headless/server/script | MIT |

Lõi mô phỏng và chế độ headless **không phụ thuộc** thư viện nào.

## Hình ảnh, mô hình, phông chữ
- **Không dùng asset ngoài.** Mọi hình khối (đảo, đèn, Mây, Bóng Mực, Gió Lạc, Bùa Gió, đèn cầm tay…) được dựng
  bằng primitive của three.js trong `web/world.js` / `web/main.js`.
- Phông chữ hệ thống (`Segoe UI`, `system-ui`), không nhúng phông ngoài.
- Ảnh trong `docs/images/` và `evidence/` là ảnh chụp màn hình chính game này.

## Âm thanh
- **Không dùng file âm thanh.** Nhạc nền và mọi hiệu ứng được **tổng hợp lúc chạy** bằng Web Audio API
  (`web/audio.js`), do tác giả tạo.

## Công cụ AI tạo nội dung
| Công cụ | Đã tạo / hỗ trợ |
|---------|-----------------|
| **Claude Code** (Anthropic; model Claude Opus) | Viết phần lớn mã nguồn (lõi, headless, web, script), test, tài liệu (README, spec, ADR, CHANGELOG, retro), lời thoại Ông Đăng; chạy kiểm thử và thu thập bằng chứng theo quy trình trong `AGENTS.md`. Nhật ký: `docs/ai-log.md` |

Không có hình ảnh, âm thanh hay mô hình nào do AI sinh ra; nội dung nghe/nhìn đều được dựng bằng code.
