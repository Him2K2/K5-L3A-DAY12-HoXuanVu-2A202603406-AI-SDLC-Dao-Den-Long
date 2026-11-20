# Kiểm bản chơi (Phase 3)

Phiên làm việc không mở trong cửa sổ nào nên trình duyệt dừng `requestAnimationFrame`. Các kiểm tra dưới
đây chạy bằng hook `window.__ddl.debugAdvance(n)` — hook này gọi **đúng các hàm thật** của vòng lặp
(`simStep` → `updateCamera` → `world.sync` → `updateHUD` → `render`), chỉ thay bộ đếm thời gian của trình duyệt.

## Ảnh

| File | Nội dung | Ghi chú trung thực |
|------|----------|--------------------|
| `01-low-fuel-warning-normal.jpg` | Chế độ thường: cảnh báo "Đèn L2 sắp cạn dầu" màu `#FF5A5F`, "Đèn sáng 2/5 · cần 3" (đỏ vì chưa đủ), thanh đom đóm `6/10`, thanh dầu trên L1, vòng vùng an toàn | Cảnh được **dựng bằng hook debug** (đặt đèn sáng/dầu, vị trí Mây, một Bóng `drain`) |
| `02-low-fuel-warning-colorblind.jpg` | Chế độ mù màu: cảnh báo trắng `#FFFFFF` kèm ⚠ | Dựng bằng hook debug; ảnh chụp **trước** khi sửa lỗi thanh dầu không hiện ở khung đầu |

## Kiểm tra bằng script trong trang (kết quả thật)

| Kiểm tra | Kết quả |
|----------|---------|
| Bấm **E thật** (qua đường input) cạnh L1 với 10 đom đóm | L1 sáng, dầu 100, sức chứa 12 (12 ô, "0/12"), "cần 3", điểm 150 |
| Đèn còn 20 dầu + 1 Bóng `drain`, chạy 60 tick thật | Dầu 20 → 14 (6/giây), có tia hút, cảnh báo hiện, vòng an toàn ẩn |
| Bật "Bảng màu dễ phân biệt" qua ô chọn thật | Lưu `localStorage`, `body.cb`, đồng hồ "⚠ 00:19" màu `rgb(255,255,255)`, đèn tắt dùng mô hình rách + xẹp 0.8, đèn sáng không đổi |
| Chạy tới bình minh với 3 đèn (1 đèn yếu) | Bóng Mực sinh ở giây 5 tự tìm tới đèn yếu và hút tắt nó → **thua `dawn` 2/5**, màn kết quả "chỉ còn 2/5 đèn sáng (cần 3)" |
| Đêm 3, 5/7 đèn sáng, chạy tới bình minh | **Thắng → màn Bình Minh**, điểm 885 = 5 × (50 + 97) + 3 × 50, khớp tính tay |
| Lỗi tìm thấy & đã sửa | HUD hiện "Châm dầu (100/100)" khi đèn còn châm được; thanh dầu bị quay lưng ở khung đầu |

Chưa kiểm: âm thanh (không có người nghe), FPS của Phase 3 (không đo được khi trang chạy nền — Phase 2
đo 58–60 FPS; Phase 3 chỉ thêm thanh dầu và tia hút, không thêm đèn chiếu sáng).
