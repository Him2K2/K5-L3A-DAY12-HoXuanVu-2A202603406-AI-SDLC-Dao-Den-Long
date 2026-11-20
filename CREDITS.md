# CREDITS

## Mã nguồn
- Toàn bộ mã lõi, headless, web và script: tự viết trong khuôn khổ bài lab, có hỗ trợ của AI theo
  quy trình trong `AGENTS.md` (nhật ký ở `docs/ai-log.md`).

## Thư viện
- **Three.js** `0.160.0` — render 3D ở bản chơi, tải qua CDN jsDelivr. Giấy phép **MIT**.
  Chế độ headless không phụ thuộc thư viện nào.

## Hình ảnh, mô hình
- Không dùng asset ngoài. Mọi hình khối (đảo, đèn, Mây, Bóng Mực, Gió Lạc, Bùa Gió…) được dựng bằng
  primitive của Three.js trong `web/world.js`.

## Âm thanh
- Không dùng file âm thanh. Nhạc nền và mọi hiệu ứng được **tổng hợp lúc chạy** bằng Web Audio API
  (`web/audio.js`) — tự tạo.

## Phông chữ
- Dùng phông hệ thống (`Segoe UI`, `system-ui`), không nhúng phông ngoài.

Nếu các phase sau thêm asset, chỉ dùng nguồn **CC0 / CC-BY / MIT** hoặc tự tạo, và ghi nguồn +
giấy phép tại đây.
