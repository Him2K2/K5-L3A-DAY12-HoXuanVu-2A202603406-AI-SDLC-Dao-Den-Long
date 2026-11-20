# AGENTS.md — Harness cho AI khi làm việc trên repo này

Tài liệu này là "hợp đồng" giữa người và AI agent khi phát triển **Đảo Đèn Lồng**.
Mục tiêu tối thượng: **đúng Test Contract v1.0 và tất định**. Đẹp/phức tạp đứng sau.

## Quy tắc bất biến (không được phá)

1. **Tất định tuyệt đối.** Lõi mô phỏng KHÔNG được dùng `Math.random`, `Date.now`,
   `performance.now`, thứ tự lặp của `Set`/`Map` theo chèn-ngẫu-nhiên, hay bất kỳ nguồn
   phi-tất-định nào. Mọi ngẫu nhiên đi qua `src/core/prng.js` (seed từ `--seed`).
   → Kiểm chứng: `npm run selftest` phải thấy "same seed => identical bytes".
2. **`game.contract.json` là sự thật.** Số trong `tuning` phải khớp `DEFAULT_TUNING`
   trong `src/core/config.js`. Đổi số ở MỘT nơi thì đổi cả hai.
   → Kiểm chứng: `node scripts/check-contract.js`.
3. **Một lõi, hai mặt.** `web/` (chơi) và `src/headless/` (chấm) phải dùng CHUNG class
   `Game`. Không fork luật chơi sang web.
4. **Sáng tạo không được đổi output headless theo contract.** Thực thể/hiệu ứng thêm phải
   tắt khi `random_*: false`, hoặc chỉ ở tầng render (`web/`), không đụng `src/core/`.
5. **Không có bằng chứng thì chưa xong.** Mọi thay đổi luật phải kèm cập nhật
   `scripts/selftest.js` và/hoặc `evidence/`. "Chạy rồi" không phải bằng chứng.

## Quy trình thay đổi (bắt buộc)

1. **Phân tích**: đọc PRD/Ticket + Contract, ghi giả định mới vào `docs/assumptions.md`.
2. **Kế hoạch kiểm chứng TRƯỚC khi code**: viết/điểm danh test trong `scripts/selftest.js`
   sẽ chứng minh thay đổi đúng.
3. **Code** trong `src/core/` (luật) hoặc `web/` (render). Giữ lõi thuần, không phụ thuộc engine.
4. **Tự review diff**: kiểm nguồn phi-tất-định, biên (0 đom đóm, đèn đã sáng, `--ticks 0`,
   file rỗng), và exit code.
5. **Chạy thật**:
   ```bash
   node scripts/check-contract.js   # tuning khớp
   npm run selftest                 # luật + determinism + exit code
   node scripts/gen-evidence.js     # sinh lại evidence/
   ```
6. **Ghi lại**: cập nhật `docs/ai-log.md` (token/chi phí, lỗi AI gặp, hiệu quả harness) và
   README nếu đổi điều khiển/điểm/giả định.
7. **Kiểm chứng lại phần cũ**: toàn bộ selftest cũ vẫn phải pass.

## Bản đồ mã nguồn

| Đường dẫn | Vai trò | Lưu ý |
|-----------|---------|-------|
| `src/core/config.js` | Tuning + hằng số + layout đèn | Nguồn sự thật của số liệu |
| `src/core/prng.js` | PRNG tất định (mulberry32) | Nguồn ngẫu nhiên DUY NHẤT của sim |
| `src/core/game.js` | Class `Game`: `step()`, luật chơi | Không I/O, không render, không random ngoài prng |
| `src/core/inputs.js` | Đọc inputs file, edge-trigger nút | Sai định dạng → ném `BadInput` (exit 2) |
| `src/core/snapshot.js` | Dựng dòng JSONL, làm tròn 3 số | |
| `src/headless/run.js` | CLI contract, map lỗi → exit code | 2 = inputs/scenario sai; khác = 1 |
| `web/main.js` | Render Three.js, lái chung `Game` | Chỉ hiển thị; không thêm luật |
| `server.js` | Static server 0-dependency cho `npm start` | |

## Checklist khi đụng tới headless/contract

- [ ] Snapshot tick 0 phản ánh trạng thái trước input, không phát sự kiện/điểm.
- [ ] Sự kiện trong bước k ghi `tick = k+1`.
- [ ] Dựng scenario KHÔNG cộng điểm / KHÔNG phát sự kiện (đèn preset `lit:true` không +100).
- [ ] `--snapshot-every` áp từ tick 0; luôn có dòng `end` cuối.
- [ ] Cùng seed/scenario/inputs → byte-identical (kể cả id tự sinh).
