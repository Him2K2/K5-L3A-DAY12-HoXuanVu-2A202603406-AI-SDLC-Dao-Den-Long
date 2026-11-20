# Đảo Đèn Lồng 🏮

> **Video demo:** _(Phase 4 sẽ thêm link .mp4 tại đây)_

Game 3D: bé **Mây** (đội nón lá có treo đèn lồng nhỏ) chạy quanh một hòn đảo giữa biển mây,
thu thập **đom đóm (motes)** mang về **thắp 5 Đèn Lồng Lớn**, trong khi **Bóng Mực (shades)**
rình trong sương. Thắp hết đèn thì **thắng**, hết mạng thì **thua**.

Kiến trúc cốt lõi: **một lõi mô phỏng tất định** (`src/core/`) được dùng chung cho cả
bản chơi 3D (Three.js) lẫn chế độ **headless** để chấm tự động — thứ bạn thấy khi chơi
chính là thứ được chấm.

---

## Cài đặt & chạy (≤ 3 lệnh)

```bash
npm install          # không có dependency runtime — lõi + headless chạy bằng Node thuần
npm start            # mở http://localhost:8080 trong trình duyệt để chơi
```

Chạy **headless** (không cần GUI/GPU):

```bash
node src/headless/run.js --seed 1 --night 1 --ticks 600 --out run.jsonl
```

> Yêu cầu Node ≥ 18 (đã test trên Node 22). Chạy được trên macOS/Linux/Windows.
> Bản chơi 3D tải Three.js qua CDN (cần mạng lần đầu); **chế độ headless không cần mạng,
> không cần dependency, không cần GPU.**

### Lệnh tiện ích

```bash
npm run selftest     # chạy bộ test tất định + luật chơi + exit code (16 test)
node scripts/check-contract.js   # kiểm tra game.contract.json khớp số trong code
node scripts/gen-evidence.js     # sinh lại toàn bộ evidence/
```

---

## Điều khiển

| Phím | Hành động |
|------|-----------|
| `W A S D` | Di chuyển (theo hướng camera) |
| Kéo chuột / `◀ ▶` | Xoay camera |
| `Space` | Nhảy |
| `E` | Thắp đèn (nạp đom đóm khi đứng gần Đèn Lồng) |
| `Shift` hoặc `Q` | Tỏa sáng (xua Bóng Mực) |

## Cách tính điểm

| Sự kiện | Điểm |
|---------|------|
| Nhặt 1 đom đóm (`per_mote`) | +2 |
| Thắp 1 đèn (`per_lantern`) | +100 |
| Mỗi Bóng Mực bị tỏa sáng làm choáng (`per_stun`) | +5 |
| Mỗi giây còn lại khi **thắng** (`per_second_left`) | +1 |
| Mỗi mạng còn lại khi **thắng** (`per_flame_left`) | +50 |

Thua (hết mạng hoặc hết giờ) **không** được thưởng điểm kết thúc.

---

## Test Contract v1.0 — chế độ headless

File `game.contract.json` ở gốc repo khai đúng mọi số `tuning` mà game đang dùng
(được `scripts/check-contract.js` canh để không lệch với code).

```
node src/headless/run.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json] \
     --ticks <int> --out f.jsonl [--snapshot-every <int=10>]
```

- Logic chạy **60 tick/giây cố định** (`DT = 1/60`), không cửa sổ, không GPU.
- Kết thúc khi đủ `--ticks` hoặc khi thắng/thua; **exit 0**.
- File inputs/scenario sai định dạng → **exit 2**; lỗi khác → exit ≠ 0, báo ra stderr.
- Đơn vị mét; **trục Y hướng lên**; đất Y = 0; player xuất phát (0,0,0).
- Output JSONL gồm `snapshot` / `event` / dòng `end` cuối; toạ độ làm tròn 3 chữ số.
- **Tất định:** cùng seed + scenario + inputs → output **byte-identical** (xem
  `evidence/determinism-run-a.jsonl` vs `-b.jsonl`).

Chi tiết quy ước tick, vị trí, và các giả định: xem [`docs/assumptions.md`](docs/assumptions.md).

---

## ✨ Sáng tạo của tôi

Ngoài phần lõi PRD-0 yêu cầu, bản này thêm (đều **không** ảnh hưởng output headless theo contract):

- **Đèn lồng là nơi trú ẩn:** Bóng Mực không bao giờ vào trong `safe_radius` quanh *mọi*
  cột đèn — chạy về chân đèn là an toàn. (Là hành vi tất định, có thể test; xem giả định.)
- **Kinh tế ánh sáng có đánh đổi:** đom đóm vừa để thắp đèn vừa là "nhiên liệu" khi tỏa
  sáng (`pulse_cost`), nên người chơi phải cân nhắc tiêu hay để dành.
- **Hiệu ứng ấm/tím:** đảo tối dần, đèn thắp lên toả sáng vàng cam ấm; Bóng Mực phát sắc
  tím đen và **co lại + mờ đi khi bị choáng** (phản hồi thị giác cho trạng thái `stunned`).
- **HUD + thanh hồi chiêu pulse**, màn thắng/thua và nút **Chơi lại**.

> Bằng chứng phần lõi vẫn đúng: `npm run selftest` (16/16 pass) và thư mục `evidence/`
> bao phủ pickup, deposit→lit, pulse→stun, player_hit→drop, dawn→lost, và determinism.

---

## Bằng chứng

- `evidence/SUMMARY.txt` — tổng hợp các lần chạy + xác nhận determinism byte-identical.
- `evidence/*.jsonl` — output headless cho từng tình huống (sinh lại bằng
  `node scripts/gen-evidence.js`).
- `docs/assumptions.md` — các giả định cho chỗ PRD-0 mơ hồ.
- `docs/ai-log.md` — nhật ký dùng AI.

## Cấu trúc

```
src/core/      lõi mô phỏng tất định (không phụ thuộc engine)
src/headless/  CLI headless theo Test Contract
web/           bản chơi 3D (Three.js)
scripts/       selftest, check-contract, gen-evidence
tests/         scenario + inputs mẫu
evidence/      output headless + chứng minh determinism
```
