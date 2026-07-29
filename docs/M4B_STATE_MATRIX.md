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

Rows once marked **VERIFY** held engine semantics not yet confirmed from source. **RESOLVED
(§3):** a read-only engine pass has replaced all six (B14, B15, B17, B19, C4, F4) with
engine-true wording + the proving test; three lack a dedicated test and are flagged as
findings there. The engine remains the truth — never implement a row that conflicts with it.

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
| B14 | LAGAAN staged | kiraya play legal | rail: **Charge** + **Bank**. Colour picker = colours you OWN (paired: its two; wild ANY: any of the ten). **Paired LAGAAN charges ALL opponents (no target step); wild LAGAAN tap-targets ONE opponent** (like VASOOLI). [engine: reduce.ts:491–526] | — |
| B15 | DUGNA LAGAAN | attaches to a LAGAAN charge | **Not a standalone play.** A ×2 / ×4 doubling toggle during LAGAAN staging; each DUGNA attached spends **one extra play** (max 2 → ×4). Never on the rail alone. [engine: reduce.ts:500–537] | tap |
| B16 | KABZA played | steal complete set | arrow targeting → only opponents' **complete** sets glow; on commit the whole set flies over | stamp-slam (KABZA is a signature moment) |
| B17 | HAATH KI SAFAI | steal one loose property | arrow/tap → only properties **NOT in a complete set** glow; complete-set cards are engine-excluded (that's KABZA's job). [engine: legal.ts:313–324; reduce.ts:422–424] | slide |
| B18 | ADLA-BADLI | swap properties | two-step: pick **mine** (glow set 1) → pick **theirs** (glow set 2) → both fly, crossing | double slide |
| B19 | MAKAAN / HAVELI | attach to own complete set | rail Play → only your **complete** sets glow (never Junctions/Utilities). MAKAAN → a complete set with no makaan; **HAVELI → a complete set that already holds a MAKAAN**. [engine: reduce.ts:337–367; legal.ts:328–353] | build tap |
| B20 | NAHI CHALEGA in hand, no window | not offered | card sleeps like any unplayable card; **never** on the rail as Play | — |

### C. Payments (the debt sheet)

| # | Situation | Engine | UI treatment | Feedback |
|---|---|---|---|---|
| C1 | You owe and can pay | interrupt: charge on you | bottom sheet: "Pay ₹N Cr to <name>", **suggestPayment pre-selected**, meter, gold Pay button | sheet slide |
| C2 | Overpay | selection > debt | meter: "₹5 / 4 Cr · no change given" — surfaced only here | — |
| C3 | Can't fully pay | table total < debt | button reads "Pay all I have"; engine takes everything payable | — |
| C4 | Nothing on table | zero payable | Engine does **not** auto-skip: the charge still opens a payment step whose only legal move is an **empty** RESPOND_PAY. UI auto-submits it → brief ticker "Nothing to pay with", no interactive sheet. [engine: reduce.ts:635–639, 737–765] | soft thud |
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
| F4 | Reshuffle moment | draw empty, discard recycles | Trigger: mid-draw, draw empty **and** discard non-empty → the **whole discard pile is seed-shuffled** into a new draw pile (deterministic); "Reshuffling…" note. Overflow buried under the draw pile is already in it → **never reshuffled**. [engine: reduce.ts:107–133, 165] | shuffle sound |

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

## 3. VERIFY ledger — RESOLVED (read-only engine pass)

Answered from `legal.ts` / `reduce.ts` / `sets.ts` / `payment.ts`; the engine is the truth.
Each answer cites file:line and the proving test — or names the missing proof as a finding.

1. **B14 — LAGAAN target scope + colour.** The colour must be one the card permits AND one
   you own: **paired LAGAAN = one of its two colours; wild (ANY) = any of the ten**
   (`reduce.ts:491–497`; `legal.ts:263–266`). **Paired (`targeted:false`) charges ALL
   opponents** (target must be `null` — `reduce.ts:521–525`); **wild (ANY, `targeted:true`)
   charges ONE chosen opponent** (target required — `reduce.ts:516–520`). Proof: colour
   ownership — `turn.test.ts:222–235` (#12, `COLOR_NOT_OWNED`, paired card). **⚠ MISSING
   PROOF:** no test exercises the wild/targeted path or the `BAD_TARGET` guards; the
   target-scope split rests on `reduce.ts:513–526` + the 500-game sim (`tools driver.test`,
   invariants only). → finding.

2. **B15 — DUGNA LAGAAN pairing.** A same-turn **ATTACH**, carried in
   `PLAY_KIRAYA.dugnaCardIds` — never a standalone play (`legal.ts:248, 268–291`). **Each
   attached DUGNA consumes one extra play** (`playsNeeded = 1 + dugnaCount` — `reduce.ts:508`).
   **Two stack → ×4** (`2^dugnaCount` — `sets.ts:126`), capped at `maxDugnaPerCharge = 2`
   (`rules.ts:31`; `reduce.ts:505`). Proof: `interrupts.test.ts:203–227` (doubles + one play
   each, ₹16 = ×4) and `:229–249` (rejects when plays short). ✓ **fully proven.**

3. **B17 — HAATH KI SAFAI exclusions.** Steals only a property **NOT in a complete set**:
   enumerated by `stealableProperties` (`legal.ts:313–324`, used at `:225`) and defended in
   reduce (`reduce.ts:422–424`, `SET_COMPLETE`). Complete sets are KABZA's domain.
   Proof: `interrupts.test.ts:135–152` (`SET_COMPLETE`). ✓ **proven.**

4. **B19 — HAVELI prerequisite.** **HAVELI requires the set to already hold a MAKAAN**
   (`reduce.ts:356–357`; `legal.ts:346`). **Both MAKAAN and HAVELI require the set to be
   COMPLETE** (`reduce.ts:342, 356`; `legal.ts:341`), and neither may sit on
   Junctions/Utilities (`reduce.ts:339`; `legal.ts:336`). Proof: `turn.test.ts:237–255`
   (#13) proves the RENT BONUS counts only on a complete set — but that is `kirayaForGroup`,
   not placement. **⚠ MISSING PROOF:** no test places a MAKAAN/HAVELI through `reduce` to
   exercise the prerequisites (`NO_MAKAAN_SPOT` / `NO_HAVELI_SPOT` / junction block); every
   building test uses pre-placed buildings via `makeState`. Code + legal + sim only. → finding.

5. **C4 — zero-payable path.** **No engine auto-resolve.** A standing charge always advances
   to `awaitingPayment` regardless of the debtor's table (`reduce.ts:635–639`); the only legal
   action is one `RESPOND_PAY` with an **empty** list (`suggestPayment` returns `[]` when
   table ≤ debt — `payment.ts:258–259`; `legal.ts:70–80`), which `validatePayment` accepts
   (empty ok when payable is empty — `payment.ts:86–92`) and `applyPayment` settles as a
   `Paid` event with no cards. Proof: `payment.test.ts:55–60` (#3, `validatePayment([])` ok +
   `totalPayableValue` 0). **⚠ PARTIAL PROOF:** the empty-selection VALIDATION is tested, but
   no named test drives the full flow (charge on an empty table → `awaitingPayment` → empty
   pay → `InterruptResolved`); code-proven (`reduce.ts:635–639, 737–765`) + sim only. → finding.
   *UI note: the engine opens the step; the UI auto-resolves it — it is not an engine skip.*

6. **F4 — reshuffle trigger + order.** During a draw, when `drawPile` is empty **and**
   `discardPile` is non-empty, the whole discard pile is **seed-shuffled** (`shuffleWithState`,
   deterministic) into a new draw pile, discard empties, `DrawPileReshuffled` fires
   (`reduce.ts:107–133`). Both empty → the draw simply stops short (`:112–114`).
   **House-rule interaction:** end-of-turn overflow discards are `unshift`ed to the **bottom of
   the draw pile** (`reduce.ts:165`), not the discard pile — so they are already in the draw
   pile and are **never** part of a reshuffle; only spent action/LAGAAN/DUGNA/NAHI cards recycle.
   Proof: `turn.test.ts:55–66` (#16, reshuffle event) + `turn.test.ts:155–189` (#15, overflow
   buried under the draw pile). ✓ **proven.**

**UI-treatment consequences:**
- **B15 changes the UI (the owner's flagged case):** DUGNA LAGAAN is an ATTACH — a doubling
  toggle during LAGAAN staging that spends extra plays, **not** a standalone rail play (row B15).
- **B14 branches the UI:** paired LAGAAN auto-hits all opponents (no target step); wild LAGAAN
  needs a tap-target step like VASOOLI (row B14).
- **C4 reframed:** the engine does not skip payment; the UI auto-plays the single empty
  RESPOND_PAY to present "no sheet" (row C4).
- B17 / B19 / F4 tightened their rows; no treatment reversal.

**Findings (engine is CORRECT; the gap is test coverage):** B14 (wild-LAGAAN target scope +
`BAD_TARGET`), B19 (building-placement prerequisites), and C4 (full empty-pay flow) have no
dedicated named test — each is exercised by the 500-game sim without a targeted assertion.
Recommend three small unit tests when M4b begins (not blocking).

**A8 Learn cards:** none of the six existing Niyam cards state LAGAAN / DUGNA / MAKAAN-HAVELI
mechanics, so **no card needs a wording fix from these six answers**; the engine-true details
above are the material for the optional **Card 7 — "Lagaan aur imaarat"** noted in
`M4B_SPEC_v1.2.md` A8 (add at M4d). *Separately flagged to the owner (outside this VERIFY
scope): A4 + Niyam Card 6 state that wildcards are universal and bankable, which the current
engine does not do — `placeableSets` gives dual wildcards only their two colours (`sets.ts:30`)
and `BANK_CARD` excludes wildcards (`legal.ts:166`).*

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
