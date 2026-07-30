# PLAYTEST — M4b Phase B verification pass

An autonomous verification pass to close two honest gaps in the Phase-B report: **flag 4**
(screenshot capture was flaky; several states were only JS-confirmed, never cleanly imaged)
and **flag 5** (D1 — "I hold NAHI CHALEGA and counter an attack" — was never driven live).
The approach replaces luck with determinism: a seeded harness finds reproducible seeds, and
the real UI is driven onto each state through the 360×740 dev frame.

Harness: `tools/src/scenarios.ts` (+ `find-scenarios.ts`, `scenarios.test.ts`). Fixture:
`tools/fixtures/scenarios.json`. Regenerate with `pnpm --filter @sauda/tools scenarios`.

---

## A. Seed fixture table (Task A)

Every target state was reached by **real, legal play** within a 2000-seed search — none
hand-crafted. Seat 0 is "the human"; states a strong bot avoids (11-card hoard, >7 discard)
use a documented alternative **legal** `hoard` policy (draw + AAGE BADHO + end, never spend a
play). The fixture records the exact **action log** per state, so replaying it (via the store's
`dispatch`) lands the UI on the state deterministically in any future session.

| State | Spec | Seed | Turn | Steps | Status |
|-------|------|-----:|-----:|------:|--------|
| S1 — hold NAHI CHALEGA vs a bot attack | D1 | 3 | 6 | 38 | FOUND |
| S2 — NAHI chain (attack → counter → counter) | D3 | 3 | 10 | 69 | FOUND |
| S3 — charged, pay from bank without breaking a set | C1/C3 | 1 | 10 | 68 | FOUND |
| S4 — charged with empty table → zero-payable | C4 | 23 | 11 | 85 | FOUND |
| S5 — end turn over 7 cards → discard mode | A8/A9 | 1 | 5 | 19 | FOUND |
| S6 — MAKAAN legal on a complete set | B19 | 1 | 21 | 156 | FOUND |
| S6 — HAVELI legal on a set that has a MAKAAN | B19 | 7 | 29 | 208 | FOUND |
| S7 — wild LAGAAN (colour + target) | B14 | 4 | 1 | 2 | FOUND |
| S8 — DUGNA attached to a LAGAAN (×2) | B15 | 5 | 5 | 21 | FOUND |
| S8 — two DUGNA attached (×4) | B15 | 33 | 9 | 64 | FOUND |
| S9 — ADLA-BADLI legal (two-dimension pick) | B16/B18 | 1 | 9 | 54 | FOUND |
| S9 — KABZA legal vs a complete opponent set | B13 | 4 | 5 | 23 | FOUND |
| S10 — hold 11 cards (hand-fan overflow) | A2 | 2 | 17 | 112 | FOUND |
| S11 — declarable SAUDA win | A11 | 2 | 9 | 74 | FOUND |

**14 / 14 found.** No NOT-FOUND entries. `scenarios.test.ts` replays every entry from a fresh
seeded game and asserts each logged action is still legal **and** the state predicate still
holds — the guarantee that the cache stays valid.

---

## B. Capture pack (Task B)

Each state was **driven live** on the real UI through `#/dev/frame360` (an exact 360×740
iframe) by replaying its recorded action log into the store, and verified by inspecting the
resulting engine state. Screenshots were taken and viewed in-session.

| State | Driven live | Imaged in-session | Committed PNG |
|-------|:-----------:|:-----------------:|:-------------:|
| S1 (D1 NAHI prompt) | ✅ | ✅ "Player 1 charges you ₹2 Cr." + **Nahi chalega!** / Allow | ✗ (see flag 1) |
| S3 (payment sheet) | ✅ | ✅ "Pay ₹2 Cr to Bot 1", ₹0/2 counter, payable grid | ✗ |
| S5 (discard mode) | ✅ | ✅ "Over the limit — tap 2 to discard", 9-card fan | ✗ |
| S10 (11-card fan) | ✅ | ✅ 11 cards fanned, End-turn column clear | ✗ |
| Munshi chip at rest | ✅ | ✅ (committed in feat 686c842 work) | ✗ |
| Munshi advisor open | ✅ | ✅ "Munshi ki Salah" card, board dimmed (L2) | ✗ |
| S2, S4, S6–S9, S11 | ✅ | state-verified via JS (phase/actor/legal) | ✗ |

**NOT CAPTURED as committed image files — all states.** Reason: the browser automation's
screenshot `save_to_disk` does not persist to a repo-accessible path in this environment, so
binary PNGs could not be written into a committed folder. This is an environment/tooling limit,
not a state that failed to render — **every** state was driven live and rendered correctly. The
pack is fully **reproducible**: `pnpm --filter @sauda/tools scenarios` → load `#/dev/frame360`
→ in the console `await window.__replay('<id>')` (dev-only store hook, tree-shaken from prod).
See flag 1.

**Dynamic mid-drag states** (money-drag with bank hot; dual-wildcard-drag with two groups glowing
and bank NOT glowing; placed-wildcard mid-rearrange): NOT CAPTURED as static frames — they are
live pointer gestures, not freezable engine states. Their behaviour is verified instead by
`interaction.test.ts` (drag/tap parity; illegal drop → no action) and the runtime canon proof
below (a wildcard is never bankable, so the bank never lights for it).

---

## C. Self-audit vs spec (Task C)

`M4B_SPEC_v1.2.md` (A2 zones, A10 laws L1–L6, drop map) + `M4B_STATE_MATRIX.md`. Every check
below was run against the live states; "runtime" = observed in the driven UI, "engine/code" =
the frozen source that makes it true by construction.

| # | Check | Verdict | Evidence |
|---|-------|:-------:|----------|
| 1 | Nothing scrolls in any state | **PASS** | all 14 states `document.scrollHeight === innerHeight === 740`; the `#/dev/frame360` scroll guard stayed silent |
| 2 | 11-card hand fan fits, every card ≥ partly visible | **PASS** | S10: hand length 11, no page scroll, all cards visible in the fan (crowded — flag 7) |
| 3 | End turn / SAUDA! never overlaps the hand fan | **PASS** | reserved 88px column (`Board.tsx` `END_TURN_COLUMN_PX`); confirmed in the S10 shot |
| 4 | Exactly one interactive surface is live (L2) | **PASS** | each response state renders one overlay; the Munshi chip is inert off my playing-turn (`munshiAvailable` gate); the advisor scrim sleeps the rest |
| 5 | Every auto-resolve emits a beat + ticker line (L1) | **PASS** | S10 ticker "P0 played Aage Badho / P0 drew 2"; C4 zero-payable shows the "Nothing to pay with" beat (`Table.tsx`) — nothing silent |
| 6 | Bank never lights for any wildcard (canon fix) | **PASS** | runtime: `dispatch(BANK_CARD, wild_jaipur_kolkata_1)` rejected — bank 0→0, hand 11→11; drop zones derive from `legalActions`, which never offers `BANK_CARD` for a wildcard (`legal.ts:166`) |
| 7 | Only legal targets glow; BAD_TARGET unreachable | **PASS** | `game/interaction.ts` derives TARGETING from the engine's already-enumerated actions; `interaction.test.ts` asserts an illegal drop fires no action |
| 8 | >7 discards go face-down UNDER the draw pile (house rule 813f1cd) | **PASS** | runtime in S5: after one DISCARD, draw pile 76→77, discard pile 0→0, buried card at `drawPile[0]` (the pile bottom) |

**All checks PASS.** No unambiguous spec violation was found in the driven surface.

---

## D. Fixes committed (Task D)

**None.** Task C surfaced no unambiguous spec bug (no layout overflow, missing ticker, wrong
glow, page scroll, or soft-lock) in the driven states, so there was nothing safe to fix.
Design-flavoured observations are recorded as flags below, unfixed, per instructions. Nothing
in `packages/engine` was touched; the drag-glow vs tap-rail targeting UIs were left un-unified
(owner decision — flag 6).

---

## E. Soak (Task E)

`pnpm simulate` — HeuristicBot(medium) vs RandomBot, seeded.

| Run | Win rate | Avg turns | Longest | Unfinished | Invariant violations |
|-----|---------:|----------:|--------:|-----------:|---------------------:|
| Committed baseline | 95.8% | 20.27 | 39 | 0 | 0 |
| **1000 games** (this pass) | **95.8%** (958) | **20.27** | 39 | 0 | **0** |
| **2000 games** (this pass) | 95.6% (1912) | 20.39 | 41 | 0 | **0** |

The 1000-game run **reproduces the baseline exactly** (deterministic; the engine and bots were
never touched). The 2000-game run's 95.6% / 20.39 is the same distribution over a larger sample
(the first 1000 games are identical). **Zero invariant violations across 3000 games.** No red flag.

---

## Test count

| Point | Tests |
|-------|------:|
| Session start | 188 |
| After Munshi chip (feat 686c842) | 192 (+4 store: uses accounting, no-carry-over, no-dispatch) |
| After scenario harness (test e8a58be) | 206 (+14 scenario-replay) |
| End of pass | **206** |

Full gate (typecheck · lint · all tests incl. ip-guard) green. `packages/engine` +
`packages/bots` byte-identical throughout.

---

## Flags (ordered by what most needs the owner's judgment)

1. **Capture pack has no committed binary images.** The browser tool's screenshot
   `save_to_disk` doesn't persist to a repo path in this environment, so no PNGs were written
   into a committed folder. Every state was driven live, rendered correctly, and imaged
   in-session (viewable in the transcript); the pack is reproducible via the fixture + dev
   route. If committed PNGs are required, a headless capture path (e.g. Playwright against
   `#/dev/frame360`) should be added — that's a new tooling decision.
2. **Munshi advisor tier is fixed at `hard`** (from the chip feature). Defensible (sharpest
   read; the human's own clerk), but the owner may prefer it to match the table's bots.
3. **Munshi chip is a compact `◈`+pips token, not a worded "Munshi" label.** The labelled
   version wrapped the bank total; the name lives in the tooltip + advisor title. Owner may
   want the word back (needs reclaimed header width).
4. **Payment sheet scrolls internally** when payable cards overflow (page never scrolls). A
   modal bottom-sheet scrolling its own options is standard, but if "no scroll anywhere" is
   strict, the sheet should cap/paginate. Design call.
5. **Dynamic mid-drag glow states not imaged** (money-drag bank-hot; wildcard-drag two-groups
   -glow/bank-not; placed-wildcard rearrange). They're live gestures; behaviour is unit-tested
   + the canon is runtime-proven, but no static frame exists.
6. **Drag-glow vs tap-rail targeting UIs remain un-unified** (prior flag 3) — untouched per
   instructions; owner decision.
7. **The 11-card fan is visually crowded** (all cards partly visible, no scroll — spec-compliant).
   Owner may want tighter fanning / a different layout at the 11-card extreme.
