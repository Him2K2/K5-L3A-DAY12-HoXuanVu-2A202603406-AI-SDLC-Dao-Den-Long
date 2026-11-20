# Đảo Đèn Lồng v1.0.0 — Bình minh

Game 3D góc nhìn thứ nhất: giúp Mây thắp và châm dầu cho các Đèn Lồng Lớn trên ba hòn đảo, giữ đảo sáng tới
bình minh. Bản phát hành cuối của Day 12 AI SDLC Lab (Test Contract v1.3).

## Chạy bản phát hành
1. Tải **`dao-den-long-web-v1.0.0.zip`** ở mục Assets bên dưới rồi giải nén.
2. Trong thư mục vừa giải nén, chạy `node server.js` (Node ≥ 18). Trình duyệt tự mở `http://localhost:8080`.
   Không có Node thì chạy `python3 -m http.server 8080` rồi tự mở trình duyệt (bảng xếp hạng khi đó lưu trong trình duyệt).

Hoặc chạy từ mã nguồn: `git clone …` → `npm install` → `node server.js`.

## Có gì mới trong v1.0.0
- Benchmark (`node scripts/bench.js --seed 42 --duration 30 --out bench.json`) và soak test 10 Đêm.
- Bảng xếp hạng cục bộ (top 10, hỗ trợ tên tiếng Việt), xuất bằng `node server.js --export-leaderboard out.json`.
- Dễ tiếp cận: đổi phím, phụ đề/chỉ báo hình ảnh, giảm chuyển động, chữ ≥ 18 px + chữ lớn, bảng màu mù màu.
- Góc nhìn thứ nhất xoay theo chuột như game bắn súng.
- Chạy offline (three.js đóng gói sẵn).

Chi tiết: `CHANGELOG.md` · Retro: `docs/retro.md` · Số đo của tác giả: `bench.json`, `soak.json`.
