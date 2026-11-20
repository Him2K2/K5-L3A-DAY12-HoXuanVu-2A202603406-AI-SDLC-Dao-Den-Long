# Đảo Đèn Lồng 🏮

> **Video demo:** _(Phase 4 sẽ thêm link .mp4 tại đây)_

Game 3D: bé **Mây** (đội nón lá, treo một chiếc đèn lồng nhỏ) chạy qua **ba hòn đảo** giữa biển mây,
thu **đom đóm** để **thắp và châm dầu cho các Đèn Lồng Lớn**, **giữ đảo sáng tới bình minh**, né
**Bóng Mực** (chúng còn hút dầu của đèn yếu) và **Gió Lạc**.

Kiến trúc: **một lõi mô phỏng tất định** (`src/core/`) dùng chung cho bản chơi 3D (Three.js) và
chế độ **headless** để chấm tự động — thứ bạn thấy khi chơi chính là thứ được chấm.
Hiện tuân thủ **Test Contract v1.2** (TICKET-03). Thay đổi phá vỡ tương thích: [`CHANGELOG.md`](CHANGELOG.md).

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
npm run selftest                 # 53 test: mỗi acceptance criterion + regression các phase trước
node scripts/check-contract.js   # game.contract.json khớp số trong code
node scripts/gen-evidence.js     # chạy mọi scenario headless → evidence/phase3/
```

---

## Điều khiển

| Phím | Hành động |
|------|-----------|
| `W A S D` / `↑ ↓` | Chạy (theo hướng camera) |
| Di chuột | Nhìn quanh (ngang + dọc), chuột tự khoá khi vào đảo |
| `V` | Đổi góc nhìn thứ nhất ⇄ thứ ba (được lưu) |
| `◀ ▶` | Xoay ngang bằng phím |
| `Space` | Nhảy |
| `Shift` | Lướt |
| `E` | Nạp ánh sáng / thắp lại / châm dầu cho Đèn Lồng |
| `Q` hoặc `F` | Tỏa Sáng (cần 3 đom đóm) |
| `Esc` / `P` | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

## Luật chơi (TICKET-03)

- Đèn thắp lên có **100 dầu**, hao 1/giây. Bấm `E` ở đèn đang sáng để **châm dầu** (mỗi đom đóm +10 dầu).
  Hết dầu thì đèn **tắt**; thắp lại chỉ cần **5** đom đóm (lần đầu cần 10).
- Đèn dưới **30 dầu** mất vùng an toàn và nhấp nháy; Bóng Mực đang lang thang sẽ tới **hút dầu** (5/giây).
- **Thắng** khi còn sống lúc bình minh và có ít nhất **3/5 · 4/6 · 5/7** đèn đang sáng. Thắp hết đèn
  không kết thúc Đêm. Hết Ngọn Lửa là thua ngay.
- Sức chứa đom đóm tăng **+2 mỗi lần thắp thành công** (10 → tối đa 20).

## Cách tính điểm

| Sự kiện | Điểm |
|---------|------|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp lần đầu / thắp lại | +100 / +40 |
| Bóng Mực trúng Tỏa Sáng | +5 mỗi con (+15 nếu nó đang hút dầu) |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | +50 + floor(dầu còn lại) |
| Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại | +50 |

**Tổng điểm game = tổng điểm các Đêm đã thắng.** (Headless: `score` là điểm của Đêm đang chạy.)

## Ba Đêm

| Đêm | Đảo | Đèn (cần giữ) | Thời gian | Điểm mới |
|-----|-----|---------------|-----------|----------|
| 1 | Đảo Bến — đảo tròn r = 40 m | 5 (≥ 3) | 240 s | — |
| 2 | Đảo Cau — 2 đảo + cầu tre, 2 bục nhảy | 6 (≥ 4) | 270 s | Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông — 3 tầng, 2 dốc, tháp chuông | 7 (≥ 5) | 300 s | Gió mạnh, Bóng nhanh hơn |

**Cài đặt:** âm lượng, độ nhạy chuột, và **"Bảng màu dễ phân biệt"** cho người mù màu (viền Bóng Mực
xanh `#00B3FF`, cảnh báo trắng kèm ⚠, đèn tắt có hình dạng khác: xẹp và rách giấy). Tất cả được lưu.

---

## Test Contract v1.2 — headless

```
node src/headless/run.js --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json] \
     --ticks <int> --out f.jsonl [--snapshot-every <int=10>]
```

- 60 tick/giây cố định; thứ tự 12 bước trong một tick đúng như ticket (xem `src/core/game.js`).
- Exit 0 khi chạy xong / thắng / thua; **exit 2** khi inputs/scenario sai định dạng; lỗi khác exit 1.
- Snapshot có `night`, `wind`, `player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}`,
  mảng `motes` (`kind`, `ttl_s`), `drifters`, `charms`; v1.2 thêm `lanterns[].{fuel, ever_lit, relit_count}`
  và `player.capacity`. Trạng thái Bóng Mực: `spawning | wander | chase | recoil | stunned | drain`.
- Sự kiện v1.2: `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight`, `game_over.reason = dawn_survived`.
- **Tất định:** cùng seed + scenario + inputs → output byte-identical (đã kiểm cả 3 Đêm).
- Một Đêm đầy đủ 21 600 tick chạy ~0.25 s (yêu cầu ≤ 30 s).

Giả định cho các chỗ ticket để mở: [`docs/assumptions.md`](docs/assumptions.md).
Spec + acceptance criteria: [`docs/spec-phase2.md`](docs/spec-phase2.md), [`docs/spec-phase3.md`](docs/spec-phase3.md).
Quyết định thiết kế: [`docs/adr/0001-lantern-fuel-and-dawn-win.md`](docs/adr/0001-lantern-fuel-and-dawn-win.md).

---

## ✨ Sáng tạo của tôi

Đều nằm ở tầng hiển thị (`web/`) nên **không** đổi output headless:

- **Ông Đăng**, người giữ đèn già, có một lời dặn riêng cho từng Đêm ở màn giới thiệu.
- **Âm thanh tổng hợp hoàn toàn bằng WebAudio**: nhạc nền đêm theo thang ngũ cung + 13 hiệu ứng,
  không dùng file âm thanh nào.
- **Vòng vùng an toàn** 6 m hiện dưới chân đèn đã thắp, để người chơi thấy chỗ trú — và **biến mất khi
  đèn yếu** (điều chỉnh theo luật TICKET-03).
- **Tia hút dầu** nhấp nháy nối Bóng Mực đang hút với đèn, cùng cảnh báo "Đèn Lx sắp cạn dầu" và mũi tên
  chỉ tới đèn yếu khi mọi đèn đều đang sáng.
- Mây **nhấp nháy khi bất tử**; Bóng Mực **co lại và mất viền tím khi bị choáng**; Gió Lạc là dải
  lụa uốn sóng; đom đóm rơi **nhấp nháy khi sắp tắt** (TTL < 2 s).
- Lá bay xoáy quanh Mây trong 2 s báo trước cơn gió, rồi thổi theo đúng hướng gió.
- Bộ đếm FPS ở góc màn hình để tự kiểm yêu cầu ≥ 30 FPS.

> Bằng chứng phần lõi vẫn đúng: `npm run selftest` (53/53) và `evidence/phase3/SUMMARY.md`
> (25 scenario headless, determinism, hiệu năng).

---

## Bằng chứng

- `evidence/phase3/SUMMARY.md` — scenario theo tính năng (Phase 1–3), tính tất định, hiệu năng.
- `evidence/phase3/selftest.txt` — output bộ test; `evidence/phase3/screens/` — ảnh + kiểm tra bản chơi.
- `evidence/phase2/`, `evidence/phase1/` — bằng chứng các phase trước (số liệu cũ, giữ làm lịch sử).
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
