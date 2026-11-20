# Video demo

**Video:** [`demo.mp4`](demo.mp4) (2 phút 40 giây, 68 MB, dưới giới hạn 100 MB của GitHub nên commit thẳng vào repo
theo phương án B của SUBMISSION.md). Link được đặt ở đầu `README.md`.

## Kịch bản đã dùng để quay (≤ 5 phút)

Video phải là **.mp4 dưới 5 phút**, đặt ở `docs/demo/demo.mp4` hoặc đính kèm GitHub Release v1.0.0, và link ở
đầu README. Quay bằng Xbox Game Bar (Windows: `Win + Alt + R`), OBS, hoặc QuickTime (macOS).

| Thời điểm | Cảnh | Lệnh / thao tác | Cho thấy |
|-----------|------|-----------------|----------|
| 0:00–0:20 | Giới thiệu | Mở README trên GitHub | Tên game, v1.0.0, 3 lệnh cài |
| 0:20–0:45 | Cài từ repo sạch | `npm install` → `node server.js` | Tự mở trình duyệt, menu chính |
| 0:45–2:15 | **Chơi trực tiếp** Đêm 1 | Di chuột xoay góc nhìn, nhặt đom đóm, `E` thắp đèn, chờ dầu xuống < 30 rồi `E` châm dầu, `Q` Tỏa Sáng Bóng Mực đang hút dầu | Luật dầu/hút dầu, HUD, phụ đề "Bóng Mực xuất hiện" + mũi tên |
| 2:15–2:40 | Cài đặt | Esc → Cài đặt: đổi phím (thử gán trùng phím → bị báo), bật mù màu, giảm chuyển động, chữ lớn | Dễ tiếp cận |
| 2:40–3:00 | Bảng xếp hạng | Thua → nhập tên tiếng Việt → bảng xếp hạng; `node server.js --export-leaderboard out.json` | Lưu đĩa + lệnh xuất |
| 3:00–3:40 | Test & headless | `npm run selftest` (60/60) · `node src/headless/run.js --seed 1 --night 3 --ticks 600 --out run.jsonl` | Bằng chứng tự động |
| 3:40–4:30 | Bench & soak | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (cửa sổ 1280×720, camera bay vòng) · `node --expose-gc --no-opt scripts/soak.js --seed 7 --nights 10 --out soak.json` | Số đo hiệu năng & ổn định |
| 4:30–4:55 | Kết | Trang GitHub Release v1.0.0, file zip | Bản phát hành |

Mẹo: tắt thông báo hệ thống khi quay; quay ở 1280×720 hoặc 1920×1080; nén bằng HandBrake nếu file > 100 MB
(GitHub giới hạn 100 MB/file trong repo; đính kèm Release cho phép tới 2 GB).
