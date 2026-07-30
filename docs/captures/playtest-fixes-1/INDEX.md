# M4b owner-playtest fix pass — before / after

Seven findings from the owner's first real playtest (30 Jul), each fixed to the letter and proven
with a before/after image pair. Frames are the REAL play UI at an exact 360×740 viewport
(deviceScaleFactor 2, reduced-motion), driven through the committed scenario fixture + the dev
`window.__replay` hook (`pnpm --filter @sauda/mobile capture:fixes`). "Before" frames were shot with
that finding's code stashed, so each pair isolates its own change.

## Finding → before/after → commit

| Finding | Before | After | Commit |
|--------|--------|-------|--------|
| **F1** hand fan: geometry + scrub | `F1_fan_11cards_before.png`, `F1_discard_before.png` | `F1_fan_11cards_after.png`, `F1_discard_after.png`, `F1_peek_after.png` | `2b9de1a` |
| **F2** auto end-of-turn | `F2_auto_end_before.png` | `F2_auto_end_after.png` | `c19d23a` |
| **F3** payment default + disclosure | `F3_payment_before.png` | `F3_payment_after.png` | `20a99a0` |
| **F4** real cards everywhere | `F4_play_on_stage_before.png` | `F4_play_on_stage_after.png` | `fd03e8a` |
| **F5** opponent row declutter | `F5_opponent_row_before.png` | `F5_opponent_row_after.png` | `e4380b1` |
| **F6** end card + scroll bug | `F6_end_card_before.png` | `F6_end_card_after.png` | `fb8e6ca` |
| **F7** why-lines on the rail | `F7_why_line_before.png` | `F7_why_line_after.png` | `ee3206c` |

What each pair shows:
- **F1** — 11-card fan clipped at the frame edge + jumbled ±10° tilt → centred, capped ≤5°, nothing
  clips (cards shrink for a dense hand); discard mode gets the same clean fan; `F1_peek_after` shows
  a scrubbed card lifted clear of its neighbours. (No "before" for peek — it is new behaviour.)
- **F2** — the manual "End turn" button that read as asking permission → the turn ends itself with a
  "Turn over — Bot 1 plays." beat, button hidden.
- **F3** — 8 property sets shown flat at equal weight → money (₹3, ₹4) + the exact ₹2 selection, the
  other 7 sets behind a quiet "Pay with property instead" expander.
- **F4** — a human play resolving as ticker text over an empty centre stage → the placed MUMBAI card
  held on stage for a beat.
- **F5** — "Bot 1 · medium" ×3 with sets wrapped into clipped rows → "Bot 1/2/3", one adaptive row + a
  "+2" chip; the 22% zone holds.
- **F6** — a "Player 2 wins!" bottom strip with a raw white button (page scrolled 778 > 740px) → a
  full-screen "SAUDA!" panel (tokens) with the three winning set banners; page silent.
- **F7** — a staged MAKAAN offering only Bank with no explanation → Bank + a greyed "needs a complete
  set" why-line.

## F3 audit verdict — the shared helper is NOT at fault

Using the scenario harness over **400 seeded games**, seat 0 faced **2638 charges** and the engine's
`suggestPayment` (which the UI pre-selects) **overpaid on 443** of them. In **0** of those did a
smaller sufficient subset of payable **table** cards exist — every overpay is the minimal legal
payment (no exact subset on the table). So `suggestPayment` never overpays when it could pay less;
`packages/engine` and `packages/bots` stay byte-identical. The owner's "3 / 2 Cr while an exact ₹2
existed" was an exact note in **hand** (never payable — you pay from the table). The real defect was
the sheet showing property at equal weight to money; F3 fixes that with a money-first default
(UI-side `refinePaymentSelection`, unit-tested: its sum is always the smallest sufficient sum) plus
progressive disclosure. Sample minimal-overpay seed: seed 4 (debt 1, minimal pay 2).

## F6 scroll bug — root cause (one paragraph)

The old end banner (`.winner` in styles.css) was an **in-flow** element rendered after the Board
inside `.table` (which has `min-height: 100vh`), with `margin: 8px 0` and padding. At game over its
height stacked on top of the full-height board, so the document ran **778px** tall against a **740px**
viewport and the page grew scrollbars — caught live by the `#/autostart` scroll guard
(`play screen scrolls: 778px > 740px`). The fix makes the end card `position: fixed` (out of flow), so
it can never grow the page; the guard is silent through the end state after the fix.

## Tests & gate

Test count **206 → 247** (engine 76 · bots 14 · tools 15 · mobile 142). New: 26 fanLayout (F1),
5 auto-end (F2), 6 payment (F3), 4 why-line + cross-kind-drop (F7). No test weakened or deleted.
Typecheck · lint · full tests · ip-guard green before every commit; the game is playable start to a
win at every commit (the store integration test drives full solo + pass-and-play games).

## Flags (≤5, ordered by owner judgment needed)

1. **F1 fan slot vs the 346px test width.** The pure `fanLayout` is proven for 12 cards at 24px
   exposure at containerWidth 346/436, but the live fan slot at 360 is ~238px (board minus the 88px
   End-turn column), so a dense hand overlaps tighter than 24px there (still never clips; scrub
   reveals each card). Widening the slot (moving End-turn) is an owner layout call, not done here.
2. **F1 peek ease is instant.** The ~90ms peek ease the finding describes is deferred to M4c (motion);
   the peek transform itself is applied instantly now (functional, capture-deterministic).
3. **F3 keeps an exact property over overpaying money.** When money can't make the exact amount the
   default selects the exact-property (e.g. jaipur ₹2) rather than overpay in money — correct per
   "never overpay when exact exists", but the owner may prefer money-with-overpay; a manual tap does it.
4. **Money-note art still the fallback plate.** F4 renders real CardFaces everywhere; money notes use
   the plain gold-ruled fallback because the money plates aren't on disk yet (M4a art batch).
5. **F6 end card is the clean placeholder.** The real victory spectacle (stamp-slam) is M4c; this is
   the tokens-only panel the finding asked for.

---
_Rerun:_ `pnpm --filter @sauda/mobile capture:fixes -- --phase=after` (add `--only=F3` to target one).
