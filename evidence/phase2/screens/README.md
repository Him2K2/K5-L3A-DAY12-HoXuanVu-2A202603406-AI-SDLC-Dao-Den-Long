# Ảnh chụp bản chơi (Phase 2)

> **Ghi chú trung thực:** các ảnh này được chụp trong Phase 2 nhưng **không có trong tag `phase-2`**:
> `scripts/gen-evidence.js` khi đó xoá cả thư mục `evidence/phase2/` trước khi sinh lại, và tôi đã chạy nó
> *sau* khi chép ảnh vào. Lỗi được phát hiện ở Phase 4; ảnh gốc (cùng file chụp) được khôi phục ở commit
> Phase 4 và script đã sửa để chỉ xoá phần nó tự sinh. Tag `phase-2` giữ nguyên, không sửa lại.

Chụp trong browser pane của Claude desktop app, Chrome/ANGLE trên GTX 1650 Ti, canvas 1280×720.
Bộ đếm FPS trong game (góc dưới trái) đo **58–60 FPS** ở 1280×720 (yêu cầu Phase 2 ≥ 30).

| File | Nội dung | Ghi chú |
|------|----------|---------|
| `01-menu.jpg` | Menu chính | — |
| `02-intro-night1.jpg` | Giới thiệu Đêm 1: tên đảo + lời Ông Đăng | — |
| `03-night3-hud.jpg` | Đêm 3: tầng 2 + tháp chuông, tầng 1, HUD đầy đủ | camera góc nhìn thứ ba của Phase 2 |
| `04-night1-3-lit-debug.jpg` | Ánh sáng môi trường tăng theo tiến độ (3/5 đèn) + vòng vùng an toàn | 3 đèn được **bật bằng hook debug** `window.__ddl` |
| `05-night2-prompt-debug.jpg` | Đêm 2: nhắc "E — Nạp ánh sáng (0/10)", bục nhảy, đảo B | vị trí Mây + 4 đom đóm **đặt bằng hook debug** |

Kiểm tra bằng script trong trang (không chụp ảnh): D sang phải màn hình / A sang trái (sửa lỗi Phase 1);
P tạm dừng làm `simTick` đứng yên; cài đặt còn sau khi tải lại trang.
