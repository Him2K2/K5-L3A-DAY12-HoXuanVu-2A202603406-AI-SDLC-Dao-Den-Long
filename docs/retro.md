# Retro — Đảo Đèn Lồng (4 phase, Day 12 AI SDLC Lab)

## 1. Tổng hợp Evaluation từng phase

| Phase | Ticket | Kết quả đo được | Điểm yếu còn lại |
|-------|--------|-----------------|-------------------|
| 1 | PRD-0, Contract v1.0 | 16/16 test; headless tất định (byte-identical); bản chơi Đêm 1 | Playtest phát hiện 2 lỗi GUI chưa có test: **A/D bị ngược**, **cảnh quá tối** |
| 2 | TICKET-02, v1.1 | 37/37 test (1 test/AC); 17 scenario headless; Đêm đầy đủ ~0.25 s (≤ 30 s); 58–60 FPS | Ảnh bằng chứng bị chính script sinh evidence xoá trước khi commit (phát hiện ở Phase 4) |
| 3 | TICKET-03 (Change Request), v1.2 | ADR + CHANGELOG; đúng 4 test cũ bị luật mới làm sai, được sửa/xoá có ghi lý do; 53/53; 25 scenario | FPS và âm thanh của Phase 3 không đo được khi trang chạy nền |
| 4 | TICKET-04 (Release), v1.3 | 60/60 test; bench (Puppeteer, cửa sổ thật); soak 10 Đêm 0 crash, RSS ×1.09; bảng xếp hạng; a11y; release zip | Số bench phụ thuộc máy chấm; video demo do người quay |

## 2. Điều hiệu quả khi làm với AI
- **Spec + acceptance criteria viết trước khi code**, mỗi test đặt tên theo mã AC (`AC1.8`, `P3.9`, `P4.5`…). Từ một dòng
  trong ticket có thể truy tới test và tới file evidence, nên review rất nhanh.
- **Một lõi tất định dùng chung** cho headless và bản chơi. Sửa luật một chỗ, test headless bao luôn bản chơi.
- **Chạy test trước khi sửa test** với Change Request: biết chính xác 4 test nào bị luật mới làm sai, không sửa
  mò, không skip âm thầm.
- **Đo trước khi sửa**: lỗi FPS khựng và RAM soak đều được xử lý bằng thí nghiệm có đối chứng (có/không đo RAM;
  6 bộ cờ V8), không đoán.
- **Hook debug chạy đúng hàm thật** (`__ddl.debugAdvance`) để kiểm HUD/màn hình khi trình duyệt dừng
  `requestAnimationFrame` ở tab ẩn.

## 3. Điều không hiệu quả
- AI dễ **tin output của chính nó**: viết test xong pass ngay thì cần tự hỏi "test này có bắt được lỗi không?".
- GUI ít được test tự động. Các lỗi A/D, cảnh tối, chữ 16 px, thanh dầu biến mất chỉ lộ ra khi thật sự nhìn
  vào màn hình hoặc đo `getComputedStyle`.
- Hiểu sai ý người dùng: "xoay chuột như góc nhìn thứ nhất" bị làm thành **hai chế độ camera + phím V**,
  trong khi người dùng chỉ cần một camera xoay theo chuột. Đáng lẽ phải hỏi lại một câu trước khi làm.
- Chạy bench **mở cửa sổ Chrome trên máy người dùng** mà không báo trước. Cửa sổ bị đóng giữa chừng 3 lần,
  và chỉ khi thêm log sự kiện trang mới phân biệt được "bị đóng tay" với "crash".

## 4. Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng |
|-----|----------------|
| Trục A/D ngược (contract +X là **bên trái** màn hình khi camera nhìn +Z) | Playtest của người → kiểm lại bằng tính vector và script nhấn phím thật |
| Đèn quá tối (three.js r160 dùng đơn vị vật lý) | Playtest → screenshot |
| 6/37 test fail ở lần chạy đầu Phase 2, **cả 6 là lỗi của test** (so số đã làm tròn 3 chữ số với sai số 1e-6, dựng tình huống sai) | Tính lại từng giá trị bằng tay trước khi sửa, **không sửa game cho test pass** |
| Biểu thức tính hao dầu rối, cho kết quả đúng chỉ do trùng hợp | Tự review diff |
| HUD "Châm dầu (100/100)" khi đèn còn 99.98 | Script trong trang đọc text HUD |
| Thanh dầu quay lưng camera ở khung đầu (billboard trước khi cập nhật camera) | Screenshot không thấy thanh → đọc vị trí/visibility bằng script |
| CSS `html, body { font-size: 1rem }` làm chữ gốc 16 px | Đo `getComputedStyle` trên toàn bộ phần tử chữ |
| Bộ đo RAM (PowerShell mỗi giây) làm khựng khung hình | So sánh có/không đo: `p1_low` 38 với 86 |
| Soak RSS ×1.27: nghi rò rỉ | Theo dõi 30 Đêm: `heapUsed` đi ngang, chỉ RSS nhảy một lần; thử 6 bộ cờ V8, xác định do TurboFan |
| `gen-evidence.js` xoá cả thư mục evidence, làm mất ảnh Phase 2 trước khi commit | Phát hiện khi cần ảnh cho README Phase 4 → kiểm `git ls-tree phase-2` |

## 5. Harness nào giúp nhiều nhất
1. **`AGENTS.md`**: quy tắc bất biến (tất định, một lõi, số chuẩn là luật) và mục **"Bài học đã trả giá"**. Mỗi
   lỗi ở mục 4 được thêm thành một dòng, nên không lặp lại lỗi đó ở phase sau.
2. **`scripts/check-contract.js`**: chặn lệch giữa `game.contract.json` và code ngay lập tức (tuning, phiên bản,
   lệnh).
3. **Skill `contract-check`**: chuẩn hoá bước "chạy thật" (contract → selftest → evidence) trước khi coi là xong,
   kèm quy trình riêng cho Change Request.
4. Hook: không dùng. `check-contract` + selftest chạy đủ nhanh (< 15 s) để gọi tay mỗi bước.

## 6. Token / chi phí AI
- **Tổng token và chi phí ước tính:** _(tác giả điền: xem usage của phiên trong Claude Code)_
- **Cách đã tiết kiệm token:** chạy test/evidence bằng script và chỉ đọc dòng tóm tắt (`grep FAIL`, `tail -1`); kiểm
  bản chơi bằng script đọc trạng thái thay vì chụp nhiều ảnh; gom kiểm tra vào một lần gọi; sửa file bằng diff
  nhỏ thay vì viết lại; chỉ đọc lại file khi nó đã đổi trên đĩa.

## 7. Nếu làm lại
- Hỏi lại một câu khi yêu cầu có hai cách hiểu (camera), và **báo trước** trước khi mở cửa sổ trên máy người dùng.
- Viết test GUI tự động sớm (Puppeteer đã có sẵn từ Phase 4): kiểm hướng phím, cỡ chữ, độ sáng cảnh ngay từ Phase 1.
- Tách hẳn thư mục evidence "sinh tự động" và "làm tay" ngay từ đầu.
- Đặt quy trình đo hiệu năng (bench + soak) từ Phase 2 để phát hiện chi phí bộ nhớ/khung hình sớm hơn.
