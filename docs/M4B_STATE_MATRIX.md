# M4B_STATE_MATRIX — Every Game Situation × Its UI
**v1.0 · Owner-approved · Companion to M4B_INTERACTION_SPEC.md · Consumed by M4b/M4c**

---

## 0. Why the game can never hit an unplanned scenario

This is guaranteed by construction, not by enumeration:

1. **`legalActions` is the only oracle.** The UI renders exactly the moves the engine
   offers — nothing else lifts, glows, or commits. An "unplanned interaction" cannot
   exist because the UI has no interactions of its own.
2. **The state space is machine-explored.** 500 full random-walk games with invariant
   checks after every action, 20 named edge-case tests, 1000-game bot sims — zero
   violations. Machine coverage beats any hand-written permutation list.
3. **Determinism.** Seeded RNG (mulberry32): any reported bug replays exactly from its
   seed. No heisenbugs.
4. **The animation queue** serialises visuals; state commits instantly and input is
   never blocked, so race conditions between "what happened" and "what's shown" cannot
   corrupt play.
5. **This matrix** covers the *designable surface*: every situation class a player can
   see gets one designed treatment. If a situation ever appears that has no row here,
   that is a spec bug to file — the engine will still have handled it legally.

Rows marked **VERIFY** contain engine semantics I have not confirmed from source; the
builder fills these from `legal.ts`/`reduce.ts` in a read-only pass before M4b screens,
and corrects the row if the engine differs. Never implement a VERIFY row from this
document alone.

---

## 1. Visual constancy laws ("consistent brightness")

The game has exactly **one lighting condition**. No screen, sheet, or moment may
invent its own brightness, saturation, or accent.

| Token | Value | Used for |
|---|---|---|
| `FELT` | indigo `#1B1E42`, fixed vignette | the only background, all screens |
| `CARD_CREAM` | `#F2E9D2` | the only bright object class |
| `ACCENT_GOLD` | `#E8B84B` | the only accent, everywhere |
| `GLOW_GOLD` | one glow spec (soft outer glow, fixed radius/opacity) | active-player ring · legal-action glow · selection ring · Munshi highlight — same token, no variants |
| `DIM_SLEEP` | saturate ≈0.7 + slight brightness drop | off-turn hand/board only |
| `SCRIM_DRAG` | ~8% dark scrim | behind a lifted/staged card |
| `SCRIM_SHEET` | ~35% dark scrim | behind bottom sheets / handoff |

Laws:
- Exactly **four visual states** exist: rest, sleep, drag-scrim, sheet-scrim. No
  screen may invent a fifth.
- Set colours appear **only on cards and their group markers**, never as UI chrome.
- No white screens, no flashes, no day/night variation; sheets are `CARD_CREAM`, not
  white. Dark, warm, constant.
- **Enforcement (builder adds in M4b):** a `tokens.test` that scans `apps/mobile/src`
  for raw colour literals outside the tokens file and fails on any hit. Consistency
  becomes mechanical, not disciplinary.
- All motion uses the §9 timing table of the interaction spec; no ad-hoc durations.

---

## 2. The matrix

Column key — **Situation** · **Engine trigger** · **UI treatment** · **Feedback**
(motion/sound/haptic, from the locked tables). All rows assume the tap → centre-stage →
rail-commit model (spec v1.2 direction).

### A. Turn lifecycle

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| A1 | Your turn starts | phase `awaitingDraw`, you current | Gold banner "Your turn" slides through (non-blocking); your avatar ring lights; pips refill | chime, light haptic |
| A2 | Draw 2 | `DRAW` | 2 cards arc from draw pile into fan; pile count ticks down | double riffle |
| A3 | Empty-hand refill (draw 5) | hand empty at turn start | same, ×5 slightly faster per card | riffle |
| A4 | Playing, N plays left | phase `playing` | pips show ●/○ live; legal cards full colour, rest `DIM_SLEEP` | — |
| A5 | A play commits | any play action | one pip dims immediately; ticker line appends | per-action sound |
| A6 | Nothing left worth doing | only `END_TURN` legal | End turn stays enabled (never pulses/nags); hand fully asleep | — |
| A7 | End turn, hand ≤ 7 | `END_TURN` | turn chip passes; next player's ring lights | soft pass |
| A8 | End turn, hand > 7 | forced `awaitingDiscard` | **Discard mode**: fan lifts, counter "Discard N", button becomes "Done" | — |
| A9 | Discarding a card | `DISCARD` | card flips **face-down** and slides **under the draw pile**; pile count ticks **up** (house rule) | slide + tick |
| A10 | Un-discard (this turn) | re-tap before Done | card returns to fan; counter updates | reverse slide |
| A11 | Win available | `DECLARE_WIN` offered | stage clears; a single gold "Declare SAUDA!" appears centre — the one celebratory button in the game | low drum |
| A12 | Win declared | win event | final placement resolves → half-beat → **stamp-slam "SAUDA!"** → results screen | stamp thunk, heavy haptic |

### B. Playing each card kind

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| B1 | Tap a hand card | — | card rises to **centre stage**, enlarged, readable; rail shows its legal verbs only | lift |
| B2 | Cancel | tap Cancel / tap elsewhere | card glides home; no state change | soft return |
| B3 | Money card staged | `BANK_CARD` legal | rail: **Bank** only | — |
| B4 | Property staged | `PLACE_PROPERTY` | rail: **Place**; my matching group (or ghost "new group" slot) glows | — |
| B5 | Property completes a set | placement makes set full | on land: gold **FULL** ribbon slides on | ribbon + medium haptic |
| B6 | 4th+ card of a full colour | overflow rule | auto-routes to a **second same-colour group**; ticker notes it | — |
| B7 | Wildcard staged | multiple `PLACE_PROPERTY` sets | rail: **Place**; every legal group glows; tap one to choose | — |
| B8 | Rearrange wildcard (free) | rearrange legal, own turn | drag a placed wildcard between groups; ghost slot; **no pip dims** | slide |
| B9 | Action staged | `PLAY_ACTION` + `BANK_CARD` | rail: **Play** and **Bank** — the duality as two labelled buttons | — |
| B10 | Banked action | `BANK_CARD` on action | flies to bank at ₹ value; first time ever: 3-s inline hint "Banked actions stay money" | note shuffle |
| B11 | AAGE BADHO played | draw-2 effect | card to centre → discard; 2 cards arc to hand | riffle |
| B12 | SHAGUN played | all-opponents charge | card plants centre; each opponent resolves **in turn order**, one at a time (C-rows) | — |
| B13 | VASOOLI played | one-opponent charge | after Play: **arrow targeting** to an opponent chip; then C-rows | pluck on target |
| B14 | KIRAYA staged | kiraya play legal | rail: **Charge** + **Bank**. **VERIFY:** target scope (all players vs one) and colour-choice mechanics from engine | — |
| B15 | DUGNA | doubles a kiraya | **VERIFY:** exact pairing (same-turn attach? separate play?) — design after engine read | — |
| B16 | KABZA played | steal complete set | arrow targeting → only opponents' **complete** sets glow; on commit the whole set flies over | stamp-slam (KABZA is a signature moment) |
| B17 | HAATH KI SAFAI | steal one property | arrow → legal single properties glow. **VERIFY:** whether cards inside complete sets are excluded | slide |
| B18 | ADLA-BADLI | swap properties | two-step: pick **mine** (glow set 1) → pick **theirs** (glow set 2) → both fly, crossing | double slide |
| B19 | MAKAAN / HAVELI | attach to own complete set | rail Play → my complete sets glow; attaches visibly atop the set. **VERIFY:** whether HAVELI requires MAKAAN first | build tap |
| B20 | NAHI CHALEGA in hand, no window | not offered | card sleeps like any unplayable card; **never** on the rail as Play | — |

### C. Payments (the debt sheet)

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| C1 | You owe and can pay | interrupt: charge on you | bottom sheet: "Pay ₹N Cr to <name>", **suggestPayment pre-selected**, meter, gold Pay button | sheet slide |
| C2 | Overpay | selection > debt | meter: "₹5 / 4 Cr · no change given" — surfaced only here | — |
| C3 | Can't fully pay | table total < debt | button reads "Pay all I have"; engine takes everything payable | — |
| C4 | Nothing on table | zero payable | **VERIFY:** engine auto-resolve path; UI shows brief ticker "Nothing to pay with" — no sheet | soft thud |
| C5 | Paying breaks my FULL set | player selects set card | small warning chip on that card "breaks your set" (suggestPayment never pre-picks this when avoidable) | — |
| C6 | Payment commits | `RESPOND_PAY` | cards fly to recipient: money→their bank, properties→their groups; my ribbons update | note count, medium haptic |
| C7 | I receive a wildcard in payment | `RESPOND_PLACE_RECEIVED` | inline chooser: my legal groups glow, I tap where it lands | slide |
| C8 | Multi-player charge resolves | SHAGUN / kiraya-all | payers resolve one at a time in turn order; ticker narrates each; my sheet only opens on my turn to pay | — |

### D. Interrupts (NAHI CHALEGA)

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| D1 | Action lands on you, you hold NAHI | window open, RESPOND_NAHI offered | compact centre prompt on the played card: "<NAME> played against you" · buttons "Nahi chalega!" (gold rim) + "Allow" · 10-s draining ring; your NAHI card glows in fan | string pluck |
| D2 | You don't hold it (solo) | only RESPOND_ALLOW | **no prompt** — brief beat, effect resolves, ticker narrates | — |
| D3 | Chain (nahi → nahi-back) | parity stack | same prompt flips to the other side; ticker states result plainly ("KABZA stands" / "KABZA cancelled") | slap on each NAHI |
| D4 | Timer expires | timeout | auto-Allow; ring completes and prompt fades | soft |
| D5 | Bot cancels YOUR action | bot RESPOND_NAHI | your staged effect visibly bounces back; ticker line; 400 ms beat so it reads | slap |

### E. Pass-and-play privacy

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| E1 | Turn handoff | next human's turn | full-screen felt + card back + "Pass to <name> — tap when only <name> can see"; nothing of either hand visible | — |
| E2 | Mid-turn interrupt handoff | charge/steal targets another human | same interstitial **always** (whether or not they hold NAHI — holding is never leaked); then their private prompt/sheet | — |
| E3 | Return handoff | response resolved | interstitial back to the turn player; ticker summarises what happened publicly | — |

### F. Piles & recycling

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| F1 | Overflow discard buried | house rule | (A9) face-down under draw pile; count up; identity never shown anywhere | tick |
| F2 | Discard pile grows | actions resolve | top face visible, quiet/desaturated; tap = long-press zoom of top card only | — |
| F3 | Draw pile runs low | count small | count chip simply shows the number; no alarm state | — |
| F4 | Reshuffle moment | draw empty, discard recycles | brief centre note "Reshuffling…" + discard flips into draw pile; **VERIFY:** exact engine reshuffle trigger/order | shuffle sound |

### G. Table states

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| G1 | Empty property area (game start) | — | faint deed outline + "Place your first deed" | — |
| G2 | Empty bank | — | faint note outline, no text | — |
| G3 | FULL ribbon gained | set completes | ribbon slides on (B5); opponent columns update the same way | ribbon |
| G4 | FULL set broken | payment/steal removes card | ribbon slides off; brief red-tint pulse on that group **only for the owner** | low thud |
| G5 | Second same-colour group | overflow | renders as a separate stack beside the first, same colour band, own count badge | — |
| G6 | Opponent board updates | any opponent event | their mini-stacks animate the same verbs at mini scale — never teleport | matching sounds, quieter |

### H. Munshi (advisor)

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| H1 | Uses remaining | 3/game | brass chip by your avatar "Munshi ×N" | — |
| H2 | Consulted | `advise()` | recommended option takes the standard `GLOW_GOLD`; one line of counsel in the ticker; chip decrements | soft bell |
| H3 | Highlight clears | your next action | glow off automatically | — |
| H4 | Spent | 0 left | chip greys out; tap gives nothing (no upsell, no timer — it's simply done this game) | — |

### I. Bots, visibly

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| I1 | Bot turn | bot current | its column header carries the ring; each play resolves with a 500–700 ms beat using the *same* animations a human causes | same sounds, quieter |
| I2 | Bot pays you | charge resolves | cards visibly fly from its column to yours | note count |
| I3 | Bot declares win | win event | same stamp moment; results screen | stamp |

---

## 3. VERIFY ledger (builder fills before M4b screens)

Read-only engine pass; correct the rows, never the engine:
1. **B14** KIRAYA target scope + colour mechanics.
2. **B15** DUGNA pairing semantics.
3. **B17** HAATH KI SAFAI exclusions (complete-set cards?).
4. **B19** HAVELI prerequisite (MAKAAN first?).
5. **C4** zero-payable auto-resolve path.
6. **F4** reshuffle trigger and ordering.
Deliverable: this file updated with the six answers + the proving test for each,
committed as `docs: state matrix engine-verified`.

---

## 4. QA gate

The matrix doubles as the manual test script for M4b/M4c exit: every row gets walked
once on-device (solo vs bots, and rows E1–E3 in pass-and-play), checked against its
UI treatment and feedback cell. A row that can't be reached in play is either dead
spec (remove) or a missing engine path (investigate — likely neither, given property
coverage).

---

## 5. Enforcement summary

- UI interactivity **only** from `legalActions` (existing law).
- Tokens file is the single visual source; `tokens.test` bans raw colour literals.
- Motion only from the §9 table; sounds/haptics only from the §10 map.
- Animation queue serialises resolutions; input never blocked.
- Any new situation discovered in play → new matrix row via owner decision, logged in
  DECISIONS.md — never an ad-hoc screen fix.

*End of matrix.*
