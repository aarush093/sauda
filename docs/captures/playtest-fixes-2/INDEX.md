# Owner playtest 2 — "real cards, real wheel" — before / after

The second owner playtest (30 Jul) findings, each fixed and proven with a before/after image pair.
Frames are the REAL UI at an exact 360×740 viewport (deviceScaleFactor 2, reduced-motion). Game
states are driven through the committed scenario fixture + the dev `window.__replay` hook; single
faces are the `#/dev/card/<id>` route at scale 3×. Rerun: `pnpm --filter @sauda/mobile capture:fixes2 -- --phase=after`.

The **BEFORE** frames were shot with the app source reverted to the pre-pass commit `f6adb03`
(`git checkout f6adb03 -- apps/mobile/src`, keeping this pass's capture script), so each pair
isolates the change.

## Findings → before/after → commit

| Finding | Before | After | Commit |
|--------|--------|-------|--------|
| **G1** tap=inspect, drag=commit | `G1_inspect_before.png` (tap → the permission RAIL) | `G1_inspect_after.png` (tap → read-only INSPECT) | `4e25f72` |
| **G2** the wheel | `G2_wheel_before.png`, `G2_wheel_11_before.png` (the fan) | `G2_wheel_after.png`, `G2_wheel_11_after.png` (the roulette wheel) | `84627d8` |
| **G3** discard overlay | `G3_discard_before.png` (fan + inline heading) | `G3_discard_after.png` (full-screen real-card grid) | `cbc8a62` |
| **G4** real cards + F4 fix | `G4_payment_realcards_before.png` (cream rects + "JAIPUR" mini), `G4_tableview_opponent_before.png` (no expand), `G4_stage_play_before.png`, `G4_end_cascades_before.png` | `G4_payment_realcards_after.png` (real notes + finished wildcard), `G4_tableview_opponent_after.png` (expand → large real cards), `G4_stage_play_after.png`, `G4_end_cascades_after.png` | `efdd982` |
| **G5** the two bare faces | `G5_wild_dual_before.png`, `G5_wild_any_before.png`, `G5_lagaan_paired_before.png`, `G5_lagaan_wild_before.png` (bare text cards) | `..._after.png` (finished in the locked anatomy) | `8b10da2` |
| **G7** Munshi's pick marker | (in `G4_payment_realcards_before`) | `G4_payment_realcards_after.png` (◈ seal + "Munshi's pick — tap Pay") | `08b047d` |
| **unchanged** property/action/money | `unchanged_property_before.png`, `unchanged_action_before.png`, `unchanged_money_before.png` | `..._after.png` — **identical** (PropertyFull/ActionFull/MoneyFull untouched) | — |

*(G6 received-on-stage is a live pointer flow over a wildcard-in-payment scenario; it is verified in
code + the `CardReceived` ticker line is visible in `G4_payment_realcards_after.png` ("P1 received
Howrah Junction → Junctions"). No static frame — it is a gesture, not a freezable state.)*

## What each pair shows

- **G1** — a tapped hand card used to stage onto the Bank/Play/Cancel RAIL (which the owner read as
  the game asking permission) → it now rises to a large read-only INSPECT with no buttons; drag is
  the only commit path.
- **G2** — the shallow overlapping fan → a half roulette WHEEL, cards spoking from a hub at the
  bottom-centre, readable tops inside the frame, bottoms disappearing off the screen edge by design.
- **G3** — discarding on the crowded fan with an inline heading → a full-screen overlay spreading
  every hand card as a real face, "Over the limit — tap N to discard", table blurred behind.
- **G4** — the payment sheet's cream "₹3 Cr"/"₹4 Cr" rectangles + a symbolic "JAIPUR" banner-and-pips
  mini → real money notes (guilloche plates) + the finished JAIPUR/KOLKATA wildcard face; opponent
  and my boards go from banner+count chips to real-card cascades; a group taps open to a full
  readable table view; the winner's sets and the stage beat are real cards.
- **G5** — the DUAL/ANY wildcard and PAIRED/WILD LAGAAN were bare white text cards → completed in
  the locked anatomy (two-colour / all-colours banner, value badge where the card has a value,
  ledger slip, works-line footer + Devanagari seal). No Gemini plates (code-drawn by locked design).
- **unchanged trio** — the property, action and money FULL faces are byte-identical before/after
  (only `WildcardFull` + `KirayaFull` changed in G5; the MID/CHIP deletion in G4 doesn't touch the
  full faces). The pair is the proof.

## The G4 audit — every surface → its renderer

Every place a card can appear now routes through **CardFace (full) / ScaledCard (full, scaled) /
CardBack** — no symbolic stand-in survives.

| Surface | Renderer |
|---|---|
| Hand (wheel) | `HandWheel` → `CardFace` |
| Inspect (tapped hand card) | `InspectCard` → `ScaledCard` |
| Centre-stage beat (human + bot) | `Board` → `ScaledCard` |
| My placed sets | `GroupRow` → `MiniGroup` → `SetCascade` → `ScaledCard` |
| Opponent boards | `OpponentGroupStrip` → `SetCascade` → `ScaledCard` |
| Tap-to-expand table view | `TableView` → `SetCascade` → `ScaledCard` |
| Payment sheet options (F4 fix) | `PaymentSheet` → `ScaledCard` |
| Discard overlay | `DiscardOverlay` → `ScaledCard` |
| Received card on stage | `Board` (receive) → `ScaledCard` |
| Targeting / rearrange / Munshi advice | `ScaledCard` |
| End overlay (winner's sets) | `EndOverlay` → `SetCascade` → `ScaledCard` |
| Draw pile · opponent hands · handoff | `CardBack` |
| Discard-pile top | `DiscardTop` → `ScaledCard` |

## F4 regression — root cause (one paragraph)

F4 claimed "real cards everywhere" and its DECISIONS note reasoned "the payment sheet already
rendered CardFaces (F3)". The sheet DID call `CardFace` — but with `size="mid"` (`PaymentSheet.tsx:76`),
and `CardFace`'s `size="mid"` branch was `MidFace`, a **symbolic** stand-in: a set-colour banner +
held-count pips for a property, a plain "₹N Cr" cream rectangle for money, and a 3-letter
`miniLabel` ("LAG") for a kiraya — never the painted plate. So F4 changed WHERE cards appear (it
added the centre-stage beat) but every board/sheet still routed through the symbolic MID/CHIP code
paths — which is exactly the owner's "cream rectangles" screenshot (see `G4_payment_realcards_before.png`).
G4 fixes it by deleting MID/CHIP outright and routing every surface through the one full face
(scaled by `ScaledCard`).
