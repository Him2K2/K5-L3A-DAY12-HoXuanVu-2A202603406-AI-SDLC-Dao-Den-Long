---
name: contract-check
description: Verify Đảo Đèn Lồng against the headless Test Contract before calling any change done — tuning sync, the full self-test suite, and regenerated evidence through the real CLI. Use after touching src/core/, game.contract.json, tests/, or before tagging a phase.
---

# contract-check

Run these from the repo root, in order, and stop at the first failure.

1. **Tuning sync** — `node scripts/check-contract.js`
   Must print `OK`. If not, `src/core/config.js` (`DEFAULT_TUNING`) and `game.contract.json`
   disagree: the ticket's standard numbers win; fix whichever side deviates from them.

2. **Self-tests** — `npm run selftest` (filter one AC with `node scripts/selftest.js AC1.8`)
   Must end `N passed, 0 failed`. Each test name starts with the AC code from `docs/spec-phase*.md`.
   When a test fails, decide which side is wrong *before* editing:
   - Re-derive the expected value from the ticket + `docs/assumptions.md` (tick counting!).
   - Snapshot coordinates are rounded to 3 dp; derived values need ~2e-3 tolerance.
   - Only change the game if the ticket says the game is wrong; never loosen a test to hide a rule bug.

3. **Evidence** — `node scripts/gen-evidence.js`
   Runs every case in `tests/headless-cases.json` through `src/headless/run.js`, checks
   determinism (byte-identical runs, all nights) and full-night performance (≤ 30 s).
   Must exit 0. Commit the regenerated `evidence/phaseN/`.

4. **New feature?** Add at least one case to `tests/headless-cases.json` and one AC-named test.
   **Rule change (change request)?** Run step 2 *before* editing any test to list exactly which old tests
   the new rule breaks; update or delete each one with a `[Pn UPDATED]` / `[Pn REMOVED]` comment and a row
   in `CHANGELOG.md`. Never skip a test silently. Evidence goes to `evidence/<phase>/`
   (`PHASE=phase4 node scripts/gen-evidence.js`).

5. **Release checks (Phase 4+)**: `node --expose-gc --no-opt scripts/soak.js --seed 7 --nights 10 --out soak.json`
   must give `crashes: 0` and `pass: true`. The benchmark (`node scripts/bench.js --seed 42 --duration 30 --out
   bench.json`) opens a real Chrome window on the user's machine: **ask the user before running it** and tell them
   not to close the window. Before tagging, confirm hand-made evidence is tracked:
   `git ls-tree -r --name-only HEAD -- evidence/<phase>`.

6. **Report honestly**: paste the pass/fail counts; mention anything only checked manually
   (GUI screens, audio, FPS) and how.
