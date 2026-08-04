# LANDSCAPE-4 N2 — the first true end-to-end playthrough

**One complete solo game, deal → win, driven through a real browser at the `tall-915x412` profile.**
This is the first time the landscape build has been played start to finish rather than sampled as
stills on device profiles. It is **not a fixture jump** — the game is dealt fresh (seed 7) and played
move by move to a real conclusion through the live store (`reduce`), rendered in a real Chromium at
915×412.

## How it was driven (honest method)

- **Seat 0 (me)** is played by the actual `HeuristicBot` brain — the same brain the Munshi shares —
  choosing only from `legalActions`. **Seats 1–3** are medium bots stepped via the store's `stepBot`.
  So every move is a real, legal move; nothing is scripted or teleported.
- Capture is held **paused** the whole run (`__saudaCapturePaused`), so no automatic beat (bot timer,
  auto-draw, auto-resolve, turn-token drain) races the driver. Every step is taken explicitly and a
  still is shot at each meaningful moment — the strip is a faithful ordered record.
- The three **human-only response surfaces are driven through the REAL controls** so "does the control
  actually do something" is genuinely tested:
  - **targeting** — the first targeted play (HAATH KI SAFAI) is a real lift → drag-onto-PLAY → chip tap;
  - **payment** — a bot's charge opens the payment surface; screenshotted, then resolved for real;
  - **discard** — seat 0's first two turns are **deliberately passed** (no plays) so the hand climbs
    past 7 and the over-the-limit overlay opens; real card taps then bury cards.
- Harness: `pnpm dev:lan` in one shell, then
  `tools/node_modules/.bin/tsx apps/mobile/scripts/playthrough-landscape.mjs --seed=7`.
  Full machine log: `playthrough/playthrough-log.json` (101 steps, 90 stills, **0 issues**).

## Result

**Seat 0 declared SAUDA! at turn 37 — a human win.** 37 turns, no soft-lock, no page scroll, no dead
control, no unhandled phase. Every screen state below was reached inside this single game.

## Verdict per screen state

| State | Still | Verdict |
|-------|-------|---------|
| **MY-TURN** | `playthrough/15_myturn_t9.png` | **PASS.** Header (You/₹), my sets rail, opponent rails, draw+discard band, Bank, Munshi chip, turn token and the hand wheel all seat cleanly. Nothing clipped or overlapping. (The passed-turn frames, e.g. `05_myturn_t5.png`, are dimmer only because they are shot mid ~250 ms focus-transition — a capture-timing artefact, not a layout bug.) |
| **SPECTATE** | `playthrough/07_spectate_t6.png` | **PASS.** The two-pane split reads: acting bot on the left with its placed groups, my dimmed panel on the right, the table band (draw 76 / discard) and "Hand 7" present. The `Bn · <place>` caption isn't in this turn-start frame (no spotlight card yet); it is proven moving in the N1 `bot_turn_captioned` clip. |
| **targeting** | `playthrough/27_targeting_t13.png` | **PASS.** "Take which property?" with every legal target glowing as a chip, HAATH KI SAFAI on stage, and the "Your sets — reference" panel open beside it. The real chip tap committed the steal (`t13 … P0 played Haath Ki Safai`). |
| **payment** | `playthrough/10_payment_t6.png` | **PASS (resolution beat).** A bot's charge stood on me while I held nothing bankable (I had passed my first turns), so the engine's zero-pay path fired and the "Nothing to pay with." beat rendered — the correct payment resolution for an empty board. The full card-selection **PaymentSheet** (with the strategic overpay) is proven moving in the N1 `overpay_owe2_pay_banked3` clips. |
| **discard** | `playthrough/06_discard_t5.png` | **PASS.** At 9 cards the wheel goes inert and the over-the-limit overlay spreads every card as a real face under "Over the limit — tap 2 to discard". Real taps buried cards (ticker: `P0 buried Dugna Lagaan under the draw pile`). See finding 1 — the "dead-tap" I first hit was a bug in my own harness, not the app. |
| **win** | `playthrough/90_win_t37.png` | **PASS.** The "SAUDA!" end overlay presents with the winner's three completed sets cascading; my three FULL sets show on the rail behind the scrim. |

## Findings

1. **(Harness bug, resolved — not an app bug.)** My first discard driver grabbed `[data-card-id].first()`,
   which matched a **hand-wheel card behind the overlay** (the wheel keeps its `data-card-id` in the DOM,
   before the overlay), so the overlay scrim correctly intercepted the tap. Scoping the tap to the
   discard overlay fixed it and the real cards bury on tap. **No app change** — I briefly added, then
   reverted, a `pointer-events:none` on the discard caption once I traced the true cause. Called out so
   nobody re-chases a phantom "dead-tap".
2. **(Design-flavoured, unfixed — for the owner.)** The **targeting overlay at 915×412** is tight: with
   a large target list the chips fill most of the width and the "Your sets — reference" panel is narrow,
   and the played card sits centrally near the grid. It is fully functional and readable; it is just
   dense on the widest landscape profile. No breakage — flagged as a layout-comfort call.
3. **(Observation.)** Passed-turn MY-TURN stills look dim because they are shot during the focus
   transition. Not a bug; noted so the still strip isn't misread.
4. **(Coverage note.)** The natural payment capture here is the zero-pay beat (empty board). The rich
   PaymentSheet path is covered by the N1 clips rather than re-forced inside this game.

**No unambiguous breakage (real overlap / soft-lock / page scroll) was found in the app during the
full game.** The single defect encountered was in the test harness and is fixed there. Accordingly N2
required **no `apps/mobile/src` or `packages/**` change** — engine + bots stay byte-identical.

## Full ordered step log

Each row: `turn  seat  state  action`. Stills referenced by number live in `playthrough/`.

```
t 1  p0  MY-TURN   drew for turn (my play-turn #1)
t 1  p0  MY-TURN   deliberately passed (no plays) to build the hand for the discard demo
t 2  p1  SPECTATE  bot 1 acting — Turn 2: Player 1
t 3  p2  SPECTATE  bot 2 acting — Turn 3: Player 2
t 4  p3  SPECTATE  bot 3 acting — Turn 4: Player 3
t 5  p0  MY-TURN   drew for turn (my play-turn #2)
t 5  p0  MY-TURN   deliberately passed (no plays) to build the hand for the discard demo
t 5  p0  discard   over the hand limit (9) — discard overlay open  → real taps bury cards
t 6  p1  SPECTATE  bot 1 acting — Turn 6: Player 1
t 6  p3  SPECTATE  bot 3 acting — P1 played Shagun
t 6  p2  SPECTATE  bot 2 acting — P3 paid P1: Bijli Ghar
t 6  p0  payment   charge stood on me; empty board → "Nothing to pay with." beat
t 7  p2  SPECTATE  bot 2 acting — Turn 7: Player 2
t 8  p3  SPECTATE  bot 3 acting — Turn 8: Player 3
t 8  p2  SPECTATE  bot 2 acting — P3 played Haath Ki Safai
t 9  p0  MY-TURN   drew; placed Purani Dilli, Mumbai, Jaipur; ended turn
t10  p1  SPECTATE  bot 1 acting — Turn 10; P1 played LAGAAN (Chennai/Bangalore); P3 paid ₹1 Cr + Hawa Mahal Road
t11  p2  SPECTATE  bot 2 acting — Turn 11; P2 played Shagun; P3 paid Assi Ghat
t12  p3  SPECTATE  bot 3 acting — Turn 12
t13  p0  MY-TURN   drew; placed wildcard (Jaipur/Kolkata)
t13  p0  targeting played HAATH KI SAFAI via the real lift→drag→chip; overlay confirmed; steal committed
t13  p0  MY-TURN   placed New Delhi; ended turn
t14–16   SPECTATE  bots 1/2/3; P3 played Kabza
t17  p0  MY-TURN   drew; played KIRAYA ×2 (Purani Dilli/Kashi) — P3 paid ₹2 Cr, P2 paid ₹1 Cr; banked money; ended turn
t18–20   SPECTATE  bots; P1 played Kabza; P2 played LAGAAN (Junctions/Utilities); P2 paid P3 ₹2 Cr
t21  p0  MY-TURN   drew; placed Mumbai, Kashi; banked money; ended turn
t22  p1  SPECTATE  P1 played LAGAAN (New Delhi/Mumbai); P3 paid ₹4 Cr
t23–24   SPECTATE  bots 2/3
t25  p0  MY-TURN   drew; placed New Delhi; played AAGE BADHO; placed Purani Dilli; ended turn
t26–28   SPECTATE  bots; P3 played LAGAAN (Junctions/Utilities); P3 received Wildcard (Jaipur/Kolkata) → Jaipur
t29  p0  MY-TURN   drew; played MAKAAN + HAVELI (buildings); banked money; ended turn
t30  p1  SPECTATE  P1 played LAGAAN (Jaipur/Kolkata); P3 paid ₹1 Cr
t31–32   SPECTATE  bots 2/3
t33  p0  MY-TURN   drew; placed Bangalore; played KIRAYA (Chennai/Bangalore) — P3 paid ₹2 Cr, P2 paid Chennai Central; played VASOOLI; ended turn
t34–36   SPECTATE  bots; P3 played LAGAAN (Purani Dilli/Kashi Ghats); P2 paid Tulsi Ghat
t37  p0  MY-TURN   drew; played HAATH KI SAFAI; placed a received wildcard; played HAATH KI SAFAI
t37  p0  win       DECLARE SAUDA! — three sets complete, human win
```

The complete, unabridged 101-row log (every bank/place, every ticker line, and the filename of every
one of the 90 frames the run shot) is in `playthrough/playthrough-log.json`. A **curated 13-frame
ordered strip** — the opening, all six screen states, and the mid-to-late set-building arc — is
committed in `playthrough/`; the full 90-frame strip is regenerable with the one command above.
