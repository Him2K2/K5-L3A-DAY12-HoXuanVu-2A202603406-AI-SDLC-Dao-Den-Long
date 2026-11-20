# AGENTS.md — Harness cho AI khi làm việc trên repo này

Hợp đồng giữa người và AI agent khi phát triển **Đảo Đèn Lồng**.
Mục tiêu tối thượng: **đúng Test Contract (hiện tại v1.2) và tất định**. Đẹp/phức tạp đứng sau.

## Quy tắc bất biến

1. **Tất định tuyệt đối trong `src/core/`.** Cấm `Math.random`, `Date.now`, `performance.now`,
   thứ tự không ổn định. Ngẫu nhiên chung đi qua `this.rng` (seed từ `--seed`); ngẫu nhiên riêng
   của từng thực thể (wander) dùng PRNG seed bằng `seed ^ hash(id)` để không xáo chuỗi chung.
   (`web/` được dùng `Math.random` cho hiệu ứng thuần hình ảnh, ví dụ lá bay.)
2. **Số chuẩn là luật.** Từ Phase 2, số liệu và bản đồ do TICKET-02 quy định, KHÔNG tự chọn:
   tuning ở `src/core/config.js` (`DEFAULT_TUNING` + hằng `R`), bản đồ ở `src/core/maps.js`.
   `game.contract.json` phải khớp `DEFAULT_TUNING` → `node scripts/check-contract.js`.
3. **Thứ tự 12 bước trong một tick là bắt buộc** (input/pause → bộ đếm → di chuyển + rơi → nhặt →
   đèn → vùng an toàn → Tỏa Sáng → bóng & Gió Lạc → chạm → spawn → thắng/thua → snapshot).
   `Game.step()` gọi đúng thứ tự này; đừng chèn logic sai bước.
4. **Một lõi, hai mặt.** `web/` và `src/headless/` dùng chung class `Game`. `web/` chỉ hiển thị,
   không thêm luật. Tạm dừng ở bản chơi = không gọi `step()`.
5. **Sáng tạo không được đổi output headless.** Thực thể/hiệu ứng thêm chỉ ở `web/`, hoặc tắt khi
   `random_*: false`.
6. **Không có bằng chứng thì chưa xong.** Mỗi AC trong `docs/spec-*.md` phải có test hoặc evidence.

## Quy trình cho mỗi Ticket (bắt buộc)

1. **Phân tích** ticket → viết `docs/spec-phaseN.md` với acceptance criteria đánh mã `ACx.y`.
2. **Giả định** cho chỗ mơ hồ → `docs/assumptions.md` (ghi rõ hệ quả, ví dụ đếm tick).
3. **Kế hoạch kiểm chứng trước khi code**: mỗi AC ↔ một test trong `scripts/selftest.js`
   (tên test bắt đầu bằng mã AC) và/hoặc một case trong `tests/headless-cases.json`.
4. **Code** `src/core/` (luật) → `web/` (hiển thị).
5. **Tự review diff** theo checklist bên dưới.
6. **Chạy thật** — dùng skill `.claude/skills/contract-check/` hoặc:
   ```bash
   node scripts/check-contract.js
   npm run selftest                 # 37+ test, phải 0 fail
   node scripts/gen-evidence.js     # evidence/phaseN/ qua CLI thật
   ```
7. **Kiểm bản chơi** trong trình duyệt (`npm start`): FPS ≥ 30 ở 1280×720, các màn hình, HUD.
8. **Ghi lại**: `docs/ai-log.md` (lỗi AI, token), README (điều khiển/điểm), commit nhỏ theo bước.

### Thêm cho Change Request (ticket có mục [THAY THẾ], ví dụ TICKET-03)

1. Viết **ADR** trong `docs/adr/NNNN-*.md` *trước khi code*: bối cảnh, quyết định (vẽ máy trạng thái nếu đổi
   mô hình), phương án đã loại, hệ quả.
2. Ghi **breaking changes** vào `CHANGELOG.md` (bảng Trước → Sau → Ảnh hưởng).
3. Chạy selftest **trước khi sửa test** để xem chính xác test nào luật mới làm sai. Mỗi test bị ảnh hưởng:
   cập nhật hoặc xoá, kèm comment `// [Pn UPDATED] lý do` / `// [Pn REMOVED] lý do` ngay tại chỗ và một dòng
   trong bảng "Test cập nhật / xoá" của CHANGELOG. **Cấm skip âm thầm.**
4. Test không bị luật mới thay thế phải giữ nguyên và vẫn đạt (regression).
5. Bản chơi: ý sáng tạo nào xung đột luật mới thì sửa theo luật mới (ví dụ vòng vùng an toàn phải ẩn khi đèn yếu).

## Bài học đã trả giá (đọc trước khi sửa)

- **Snapshot làm tròn 3 chữ số** → test so giá trị dẫn xuất (khoảng cách…) phải dùng sai số ~2e-3,
  không phải 1e-6. Đừng "sửa game" khi test fail vì làm tròn.
- **Thứ tự bộ đếm**: giảm ở bước 2 trước hành động → đặt bất tử 90 ở tick k thì tick k+90 bị đánh được.
  Recoil/đẩy lùi áp bước đầu ngay tick gây ra để tổng quãng đường đúng 2 m / 4 m.
- **Trục camera**: theo contract, `move x=+1` khi yaw 0 là +X = **bên trái** màn hình khi camera nhìn
  +Z. Phím D phải gửi `x = −1`. (Lỗi thật ở Phase 1.)
- **three.js r160 dùng đơn vị ánh sáng vật lý**: cường độ PointLight cỡ hàng chục, không phải ~1.
- Bóng Mực trong scenario giữ nguyên `y` ở snapshot tick 0; khi di chuyển `y = mặt đất + 1`.
  Muốn test chênh cao thì nâng **Mây**, không nâng Bóng.
- **Dầu đèn là số nguyên đơn vị 1/60** (`fuelU`). Không bao giờ cộng/trừ 1/60 dạng số thực. Đổi ra số thực
  chỉ ở `fuelOut()` (snapshot/sự kiện) — và ở HUD dùng `floor(fuelU/60)`, đừng làm tròn trước rồi floor
  (lỗi thật: HUD hiện "100/100" khi đèn còn châm được).
- Dầu trừ ở bước 2 **trước** tương tác ⇒ lúc bấm E đèn sáng không bao giờ đầy đúng 100.
- Mọi kiểm "có vùng an toàn không" phải qua `_hasSafeZone(l)` (sáng **và** fuel ≥ 30), không viết lại `l.lit`.
- Web: cập nhật camera **trước** `world.sync()` vì billboard (thanh dầu) copy quaternion của camera
  (lỗi thật: thanh dầu bị quay lưng, biến mất ở khung đầu).
- Trang ẩn ⇒ `requestAnimationFrame` dừng. Để kiểm HUD khi không ai nhìn, dùng `window.__ddl.debugAdvance(n)`
  (chạy đúng các hàm thật), và ghi rõ trong evidence ảnh nào có dựng cảnh bằng hook debug.

## Bản đồ mã nguồn

| Đường dẫn | Vai trò |
|-----------|---------|
| `src/core/config.js` | Tuning chuẩn (contract) + hằng số luật `R` |
| `src/core/maps.js` | 3 Đêm: `ground(x,z)`, đèn, điểm sinh, bục nhảy, bùa |
| `src/core/game.js` | Class `Game`, 12 bước/tick |
| `src/core/inputs.js` | Inputs file → trạng thái/tick, edge-trigger (jump/interact/pulse/dash/pause) |
| `src/core/snapshot.js` | Dòng JSONL v1.1 |
| `src/headless/run.js` | CLI contract, exit code (2 = inputs/scenario sai) |
| `web/main.js` | Luồng 3 Đêm, menu, tạm dừng, cài đặt, HUD, input |
| `web/world.js` | Dựng cảnh 3D theo Đêm + đồng bộ thực thể |
| `web/audio.js` | Âm thanh tổng hợp WebAudio (bảng sự kiện→âm ở đầu file) |
| `web/palette.js` | Bảng màu chuẩn TICKET-02 + công thức ánh sáng môi trường |
| `tests/headless-cases.json` | Scenario headless theo tính năng (≥ 1/tính năng) |
| `docs/adr/` | Quyết định thiết kế (ADR) cho các thay đổi luật lõi |
| `CHANGELOG.md` | Breaking changes theo phase + bảng test cập nhật/xoá |

## Checklist review diff

- [ ] Không có nguồn phi-tất-định mới trong `src/core/`.
- [ ] Sự kiện bước k ghi `tick = k+1`; dựng scenario không phát sự kiện/điểm.
- [ ] Thực thể sinh ở bước 10 chỉ tương tác từ tick sau.
- [ ] Trường mới của snapshot/scenario/event khớp contract (tên, đơn vị giây vs tick).
- [ ] `check-contract` OK, `selftest` 0 fail, `gen-evidence` exit 0.
