# Đảo Đèn Lồng 🏮

> **Video demo:** _(Phase 4 sẽ thêm link .mp4 tại đây)_

Game 3D: bé **Mây** (đội nón lá, treo một chiếc đèn lồng nhỏ) chạy qua **ba hòn đảo** giữa biển mây,
thu **đom đóm** để **thắp lại các Đèn Lồng Lớn** trước bình minh, né **Bóng Mực** và **Gió Lạc**.

Kiến trúc: **một lõi mô phỏng tất định** (`src/core/`) dùng chung cho bản chơi 3D (Three.js) và
chế độ **headless** để chấm tự động — thứ bạn thấy khi chơi chính là thứ được chấm.
Hiện tuân thủ **Test Contract v1.1** (TICKET-02).

---

## Cài đặt & chạy (≤ 3 lệnh)

```bash
npm install     # không có dependency runtime
npm start       # mở http://localhost:8080 để chơi
```

Headless (không cần GUI/GPU/mạng):

```bash
node src/headless/run.js --seed 1 --night 2 --ticks 600 --out run.jsonl
```

> Node ≥ 18 (đã test Node 22). Chạy được trên macOS/Linux/Windows.
> Bản chơi tải Three.js qua CDN (cần mạng lần đầu); headless thì không.

```bash
npm run selftest                 # 37 test: mỗi acceptance criterion + regression Phase 1
node scripts/check-contract.js   # game.contract.json khớp số trong code
node scripts/gen-evidence.js     # chạy mọi scenario headless → evidence/phase2/
```

---

## Điều khiển

| Phím | Hành động |
|------|-----------|
| `W A S D` / `↑ ↓` | Chạy (theo hướng camera) |
| Chuột (click để khoá chuột) / kéo / `◀ ▶` | Xoay camera |
| `Space` | Nhảy |
| `Shift` | Lướt |
| `E` | Nạp ánh sáng vào Đèn Lồng |
| `Q` hoặc `F` | Tỏa Sáng (cần 3 đom đóm) |
| `Esc` / `P` | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Cách tính điểm (chuẩn TICKET-02)

| Sự kiện | Điểm |
|---------|------|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần) | +5 |
| Khi **thắng** Đêm | + floor(giây còn lại) × 2 + 50 × Ngọn Lửa còn lại |

**Tổng điểm game = tổng điểm các Đêm đã thắng.** (Headless: `score` là điểm của Đêm đang chạy.)

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm mới |
|-----|-----|-----|-----------|----------|
| 1 | Đảo Bến — đảo tròn r = 40 m | 5 | 300 s | — |
| 2 | Đảo Cau — 2 đảo + cầu tre, 2 bục nhảy | 6 | 330 s | Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông — 3 tầng, 2 dốc, tháp chuông | 7 | 360 s | Gió mạnh, Bóng nhanh hơn |

---

## Test Contract v1.1 — headless

```
node src/headless/run.js --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json] \
     --ticks <int> --out f.jsonl [--snapshot-every <int=10>]
```

- 60 tick/giây cố định; thứ tự 12 bước trong một tick đúng như ticket (xem `src/core/game.js`).
- Exit 0 khi chạy xong / thắng / thua; **exit 2** khi inputs/scenario sai định dạng; lỗi khác exit 1.
- Snapshot có `night`, `wind`, `player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}`,
  mảng `motes` (`kind`, `ttl_s`), `drifters`, `charms`. Trạng thái Bóng Mực:
  `spawning | wander | chase | recoil | stunned`.
- **Tất định:** cùng seed + scenario + inputs → output byte-identical (đã kiểm cả 3 Đêm).
- Một Đêm đầy đủ 21 600 tick chạy ~0.25 s (yêu cầu ≤ 30 s).

Giả định cho các chỗ ticket để mở: [`docs/assumptions.md`](docs/assumptions.md).
Spec + acceptance criteria: [`docs/spec-phase2.md`](docs/spec-phase2.md).

---

## ✨ Sáng tạo của tôi

Đều nằm ở tầng hiển thị (`web/`) nên **không** đổi output headless:

- **Ông Đăng**, người giữ đèn già, có một lời dặn riêng cho từng Đêm ở màn giới thiệu.
- **Âm thanh tổng hợp hoàn toàn bằng WebAudio**: nhạc nền đêm theo thang ngũ cung + 13 hiệu ứng,
  không dùng file âm thanh nào.
- **Vòng vùng an toàn** 6 m hiện dưới chân đèn đã thắp, để người chơi thấy chỗ trú.
- Mây **nhấp nháy khi bất tử**; Bóng Mực **co lại và mất viền tím khi bị choáng**; Gió Lạc là dải
  lụa uốn sóng; đom đóm rơi **nhấp nháy khi sắp tắt** (TTL < 2 s).
- Lá bay xoáy quanh Mây trong 2 s báo trước cơn gió, rồi thổi theo đúng hướng gió.
- Bộ đếm FPS ở góc màn hình để tự kiểm yêu cầu ≥ 30 FPS.

> Bằng chứng phần lõi vẫn đúng: `npm run selftest` (37/37) và `evidence/phase2/SUMMARY.md`
> (17 scenario headless, determinism, hiệu năng).

---

## Bằng chứng

- `evidence/phase2/SUMMARY.md` — scenario theo tính năng, tính tất định, hiệu năng.
- `evidence/phase2/selftest.txt` — output bộ test.
- `evidence/phase2/screens/` — ảnh chụp bản chơi (có ghi chú trung thực ảnh nào dùng hook debug).
- `evidence/phase1/` — bằng chứng Phase 1 (số liệu cũ, giữ làm lịch sử).
- `docs/ai-log.md` — nhật ký dùng AI.

## Harness AI

`AGENTS.md` (quy trình + bài học), `CLAUDE.md` (trỏ về AGENTS), skill
`.claude/skills/contract-check/` (quy trình kiểm chứng trước khi coi là xong).

## Cấu trúc

```
src/core/      lõi tất định: config (tuning), maps (3 Đêm), game (12 bước/tick)
src/headless/  CLI theo Test Contract
web/           bản chơi 3D: main (luồng/HUD), world (cảnh), audio, palette
scripts/       selftest, check-contract, gen-evidence
tests/         headless-cases.json (scenario theo tính năng)
docs/          spec, giả định, nhật ký AI
evidence/      phase1/, phase2/
```
