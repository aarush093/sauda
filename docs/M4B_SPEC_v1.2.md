# M4B_SPEC_v1.2 — Amendment Layer
**Owner-approved · Sits on top of M4B_INTERACTION_SPEC.md (v1.0) and M4B_STATE_MATRIX.md**
**Read this FIRST; where it conflicts with v1.0, this wins. Everything in v1.0 not overridden here still holds.**
**v1.2 adds: A8 Learn-screen content ("Niyam"), A9 strategy wisdom ("Munshi ki Salah"), and the advice-placement decision.**

---

## Why this amendment exists

v1.0 was written before the visual mockups existed. Five screens were then designed and
owner-approved (play table, payment sheet, interrupt prompt, home menu, victory), which
settled the interaction model and several open questions. v1.2 additionally specs the
Learn screen's actual content — rules and strategy — so no stone is left unturned before
M4b/M4d build it.

---

## A1 — Interaction model: TAP → CENTRE STAGE → RAIL (supersedes v1.0 §5 drag-primary)

The primary verb is **tap**, not drag. Confirmed by the approved play-screen mockup and
grounded in the muscle memory of the genre's leading digital title.

- **Tap a hand card** → it rises to a **centre stage** slot, enlarged and readable, the
  table still visible behind a light scrim.
- A **right-hand action rail** shows only that card's legal verbs as round buttons
  (Play / Bank / Place / Cancel — whichever `legalActions` allows). Exactly one button
  is gold-filled (the primary action); the rest are gold-rimmed outlines.
- **Commit** by tapping a rail button. **Cancel** by tapping Cancel or anywhere off the
  card. Nothing commits without a rail tap — no accidental plays.
- **Targeted actions** (KABZA, HAATH KI SAFAI, ADLA-BADLI, VASOOLI, and where relevant
  LAGAAN): after the rail's Play, the card plants centre and legal targets glow; tap a
  target to commit, Cancel to abort. (Arrow-drag from v1.0 §5 is dropped in favour of
  tap-target, matching the rail model. The targeting concept and the "only legal
  targets glow" rule remain.)

**What stays from v1.0 §5:** the action/bank duality shown as two clearly-labelled
options; legality driven only by `legalActions`; wildcard rearrangement as a free
own-turn move; the label-before-commit principle (rail button text states the outcome,
e.g. "Bank ₹4 Cr", before the tap).

**What's dropped:** lift-32dp drag-to-play as the primary gesture, the drag scrim as the
main play affordance (a light stage scrim replaces it — see A5).

## A2 — Table anatomy (confirms v1.0 §3, mockup-aligned)

Top → bottom, one portrait screen, no scrolling in play:
1. **Compact opponent row (~22%)** — up to three columns; each a slim pill header
   (avatar, name, gold ₹ bank total) over that opponent's groups as **simplified**
   mini-cards (coloured banner strip + count badge only); FULL sets wear a gold ribbon.
   The **active player's** header carries the gold ring + play pips; others sit dim.
2. **Table band (~10%)** — draw pile (ornate back + count) and a quiet, desaturated
   discard pile; open felt otherwise.
3. **Centre stage (~30%)** — the tapped card, enlarged, gold halo; the action rail to
   its right.
4. **My area (~38%, largest)** — my groups as slightly larger mini-cards, my bank as an
   overlapping note stack with mono ₹ total, then my hand as a wide comfortable arc.
   Play pips sit directly above the "End turn" button, bottom-right.

Hierarchy law: **the turn player's own area is always the largest zone; opponents
compress.** Never invert this.

Scope of the no-scroll law: it governs the **play surface** — the four zones above. A
**modal overlay** (payment sheet, interrupt prompt, Munshi advisor) MAY scroll **internally**
when its own content overflows a small screen; the table beneath it never scrolls. An
internally-scrolling sheet is spec-compliant — do not "fix" it (capping/paginating a modal is a
later design choice, not a compliance bug). [Phase-B flag 4 ruling; see DECISIONS.md]

## A3 — Screens locked (mockups are the visual reference, not the code)

Five approved references exist; M4b builds them in code (mockup text/art is placeholder):
1. **Play table** — as A2.
2. **Payment sheet** — bottom sheet ~60%, title "Pay ₹N Cr to <name>", tappable cards
   with gold selection rings, running meter incl. "no change given", one gold
   "Pay ₹N Cr" button; table dimmed above. (Matches v1.0 §6.)
3. **Interrupt prompt** — compact centre prompt on the played card, "<NAME> played
   against you", gold-rim "Nahi chalega!" + quiet "Allow", draining gold timer ring,
   table stays fully visible; the counter card glows in hand. (Matches v1.0 §7.)
4. **Home menu** — mostly empty felt; the wordmark as a worn crimson rubber-stamp
   impression; one angled card back as sole decoration; three spaced inset buttons
   (Play gold-filled · Pass and play · Learn, outlined); gear + speaker icons at the
   bottom. **Learn opens the A8/A9 content.**
5. **Victory** — the stamp-slam as the single celebratory spectacle (SAUDA!), winner
   avatar with gold ring, their three completed sets as small ribboned fans, three
   quiet stat chips, "Play again" (gold) + "Home" (outlined). No confetti.

## A4 — Wildcards are NOT universal (corrects an earlier draft's error)

An earlier draft of this section claimed all 11 wildcards were universal — a "rules change
shipped" under commit `4055711`, with re-sim figures. **That was an owner-side error:
commit `4055711` never existed and the engine never shipped any such change.** The engine,
unchanged since M1, is:

- **9 dual wildcards** place **only in their two colours** (`placeableSets` returns the
  card's own `colors` for a dual — `sets.ts:30`) and carry a **₹ value** — a dual wildcard
  on the table can be handed over as payment at that value.
- **2 ANY wildcards** place in **any set** (`placeableSets` returns every set for `'ANY'`)
  but are **valueless (₹0)** and can **never be used as payment** (`isAnyWildcard` → ₹0,
  excluded from `payableCards` — `sets.ts`, `payment.ts`).
- **No wildcard is ever banked** — `BANK_CARD` accepts only money / action / kiraya cards
  (`legal.ts:166`); every wildcard is placed as property.
- **Card faces are already correct — do NOT unify them.** A **dual** wildcard shows its true
  **two-colour split + ₹ value chip**; an **ANY** wildcard shows the **all-colours band +
  "no value"**. A wildcard must never visually imply a placement the engine forbids, so the
  two-colour split is required — not a defect to "fix".

## A5 — Visual constancy (reaffirms STATE_MATRIX §1, adjusted for tap model)

The four visual states: **rest · sleep (off-turn) · stage-scrim (light, behind the
centre-staged card) · sheet-scrim (behind bottom sheets/handoff).** One gold glow token
serves active-ring / legal-glow / selection / Munshi. The `tokens.test` (ban raw colour
literals outside the tokens file) applies from the first M4b screen.

## A6 — Naming (shipped in theme.ts)

Display strings: **LAGAAN** (was KIRAYA) and **DUGNA LAGAAN** (was DUGNA). Engine keys
and plate filenames unchanged. All UI copy, Munshi templates, and ticker lines use the
new display names.

## A7 — Ledger slip (shipped)

Property/wildcard/lagaan cards carry a uniform aged-cream ledger-slip panel behind the
rent/FULL rows (reverses v1.0's no-wash rule; art QC is complete so robustness wins).
One consistent treatment, never per-plate. Money and action cards don't use it.

---

## A8 — Learn screen content: "Niyam" (the rules, exact copy)

A swipeable deck of six rule cards on the felt, each one screen, vintage-slip styling.
This is reference material reachable from Home → Learn; it is never forced (v1.0 §12
still governs: the interface itself is the tutorial). Copy below is final English; the
builder renders it verbatim (typography per tokens). Where a card touches a VERIFY row
of the STATE_MATRIX, finalise its wording only after the engine read.

**Card 1 — Jeet (How to win)**
Collect three COMPLETE property sets in three DIFFERENT colours. Declare SAUDA! on your
own turn to win. The game checks; you declare.

**Card 2 — Turn (Your turn, every turn)**
Draw 2 cards (5 if your hand is empty). Then up to 3 plays — any mix: place properties,
bank money, play or bank actions. All three, or fewer, or none. End your turn when done.

**Card 3 — Haath ki seema (Hand limit)**
End your turn holding more than 7 cards and you must discard down to 7. Discarded cards
slide face-down UNDER the draw pile — buried, out of reach for a long time.

**Card 4 — Paisa aur bhugtaan (Money and payment)**
Bank money cards — and any action card — for its ₹ value. Once banked, it is money
forever. When you owe, YOU choose what to pay with: notes, properties, any mix. No
change is given. Properties can never be banked.

**Card 5 — NAHI CHALEGA (The counter)**
When an action is played against you, a window opens: play NAHI CHALEGA from your hand
to cancel it. It costs no play and works even off-turn. A counter can be countered.

**Card 6 — Wildcards**
A dual wildcard joins **either of its two colours** and carries a ₹ value (it can be used to
pay). The two ANY wildcards join **any** colour but are worth **nothing** and can never pay.
Moving a placed wildcard between your own sets on your turn is free.

*(If the VERIFY pass surfaces LAGAAN/DUGNA-LAGAAN/MAKAAN-HAVELI details worth a seventh
card, add "Card 7 — Lagaan aur imaarat" with engine-true wording at that time.)*

## A9 — Strategy wisdom: "Munshi ki Salah" (the advice, exact copy)

**Placement decision (owner):** strategy advice lives in exactly two places — this Learn
section, and Munshi's in-game consults. **The game never volunteers advice unprompted.**
No mid-game strategy toasts, no "did you know" nudges. This protects the no-clutter,
no-nagging law; the three one-time mechanical hints of v1.0 §12 remain the only
unprompted teaching, and they teach mechanics, not strategy.

A second swipeable deck after Niyam, titled "Munshi ki Salah". Every line below is
engine-true — each mirrors what the HeuristicBot actually values, so the Learn screen
and live Munshi can never contradict each other. Builder: cross-check each against the
shared `recommend()` evaluation during implementation; if any tip misstates the bot's
logic, flag it to the owner rather than shipping it.

**Salah 1 — Pehle paisa (Bank early)**
Early on, bank a cushion of notes. When LAGAAN or VASOOLI hits, you'll pay with money —
not with the deeds you're building. An empty bank means paying with your board.

**Salah 2 — Poora set, poora khatra (A full set invites KABZA)**
KABZA can only seize a COMPLETE set. An unfinished set cannot be swept. Complete a set
when you can defend it — NAHI CHALEGA in hand — or when completing it wins you the game.

**Salah 3 — NAHI CHALEGA sambhal ke (Hold the counter)**
Banking NAHI CHALEGA for its ₹ value is tempting — and leaves you defenceless. Its true
price is the KABZA it cancels late in the game.

**Salah 4 — Wildcard aakhri mein (Keep wildcards flexible)**
A wildcard placed early is a decision made early. Place them late, and remember: moving
one between your sets on your turn is free. Options are worth more than speed.

**Salah 5 — Dene mein hoshiyari (Pay smart)**
When you must pay: notes before deeds, spare colours before scarce ones, and never break
a FULL set if any other payment exists. The suggested payment already follows this — 
edit it only when you know why.

**Salah 6 — Nazar saamne wale par (Watch their sets)**
An opponent one card from a full set is the moment to act — HAATH KI SAFAI a key deed
now, or hold KABZA for the instant it completes. After they finish is also an
opportunity, if you can win the counter war.

**Salah 7 — Teen chaal, zaroori nahi (Three plays are a ceiling, not a duty)**
You may play fewer than three. Sometimes holding a card beats playing it — but end your
turn over 7 cards and the extras get buried under the draw pile. Hoard with a plan.

---

## A10 — Drag-first interaction layer (Phase B · owner-approved)

**Supersedes A1 as the PRIMARY path; A1 tap→stage→rail survives verbatim as the fallback.**
The approved play muscle memory is drag: lift a card, drop it on a glowing zone. Everything
A1 said still holds for the tap path; this section adds the drag layer, the auto-draw model,
and the wildcard-rearrange drag, and states the six laws (L1–L6) governing the whole play
surface. The engine is frozen; every zone, target, and glow derives from `legalActions` only.

### The six UX laws (A10 · L1–L6)

- **L1 — Nothing resolves silently.** Every auto-resolve — a window whose `legalActions` holds
  exactly one move (D2 auto-allow, C4 zero-payable, a forced discard) — plays a ~500 ms beat and
  appends one ticker line. The player always sees what the game did on their behalf.
- **L2 — One live surface.** At most one interactive surface is active at any moment (stage,
  targeting, sheet, prompt, discard, handoff); everything else sleeps under DIM. Two decisions
  never compete for one tap.
- **L3 — One gesture commits.** A play is one continuous drag from a hand card to a glowing drop
  zone, reversible until release (drop in dead space = spring home, no state change). Tap→stage→
  rail (A1) is the equal fallback. Only irreversible moments (payment, declare win) carry an
  explicit confirm — the pay/declare button itself; never a second dialog.
- **L4 — Auto-draw.** The turn-start draw is automatic — no zero-choice tap. On entering
  `awaitingDraw` for the seat holding the device the UI dispatches `DRAW`; the pile count ticks,
  pips refill. In pass-and-play it fires after the handoff interstitial is dismissed, so the
  incoming player watches their own draw. The pile is display + the face-down under-pile discard
  destination only; it is never tapped to draw.
- **L5 — Legality is the only oracle.** A card lifts, a zone glows, a target highlights **iff**
  `legalActions` offers that move. Illegal is impossible, never punished; the UI re-implements no
  rule. (Restates §1 law 3 / §11 for the drag layer.)
- **L6 — Modifiers attach, never stand alone.** A card that only modifies another play (DUGNA
  LAGAAN) is never an independent verb: while a LAGAAN is staged/targeting it appears as a ×2 / ×4
  attach chip (or a drop onto the staged LAGAAN), each attach spending one extra play at commit
  per the engine (matrix B15). It has no drop zone of its own.

### Interaction state machine (UI-only; engine untouched)

States: **REST · PRESSED · DRAG · STAGED · TARGETING · SHEET · PROMPT · SLEEP · DISCARD · HANDOFF.**

- **REST** — my turn, nothing active; centre stage empty.
- **PRESSED(card)** — pointerdown on a hand card; it peeks above its neighbours. Release within an
  8 px slop = tap → **STAGED** (A1). Move beyond 8 px → **DRAG**.
- **DRAG(card)** — pointer captured; the card rides the pointer at ~1.12×, lifted ~32 px above the
  touch point (never under the finger), top z-index, strong shadow. Every legal drop zone glows
  soft; the zone under the pointer glows hot. Release on a hot zone commits its verb; release
  elsewhere springs home to REST. Reversible until release.
- **STAGED(card)** — the A1 rail, unchanged: one gold-focused primary verb; tapping the staged
  card again commits the primary; Cancel or tap-off = REST.
- **TARGETING(action)** — a committed action still needs a target (KABZA, HAATH KI SAFAI,
  ADLA-BADLI, VASOOLI, wild LAGAAN). The card sits on stage; only legal targets (from
  `legalActions`) glow; one tap fires the exact enumerated action. Cancel returns the card to
  hand, no play consumed. Multi-pick actions glow one dimension at a time (ADLA-BADLI mine→theirs;
  wild LAGAAN colour→target). Untargeted actions (SHAGUN, AAGE BADHO) commit on drop. **The UI can
  never send a BAD_TARGET** — it only ever fires an action the engine already enumerated.
- **REARRANGE (matrix B8)** — on my turn a placed wildcard drags from its group to any group
  `legalActions` allows (`REARRANGE_WILDCARD`) — free, no play consumed. Tap fallback: tap the
  placed wildcard → legal destination groups glow → tap one. A wildcard with no legal move does
  not lift.
- **SHEET / PROMPT / SLEEP / DISCARD / HANDOFF** — per §6–§8; one at a time (L2).

### Drop map (zones light ONLY from `legalActions`)

| Dragged card | Glowing drop zones | Result |
|---|---|---|
| Money | my bank | `BANK_CARD` |
| Property | its legal set group(s) | `PLACE_PROPERTY` |
| Wildcard | its legal groups (dual = its 2 colours · ANY = every set) | `PLACE_PROPERTY` |
| Action | centre PLAY zone **and** my bank | `PLAY_ACTION` / `BANK_CARD` (dual-drop) |
| MAKAAN / HAVELI | a legal complete set (matrix B19) | `PLAY_ACTION` build |
| LAGAAN | centre PLAY zone (then B14 flow) **and** my bank | `PLAY_KIRAYA` / `BANK_CARD` |
| DUGNA LAGAAN | the staged LAGAAN (attach chip) | attaches, never standalone (L6) |
| placed wildcard | another legal group | `REARRANGE_WILDCARD` (free) |

**Wildcards are never banked** (engine truth: `BANK_CARD` excludes every wildcard — `legal.ts:166`;
A4). Nine dual wildcards place in their two colours and carry a ₹ value usable as *payment* on the
table; two ANY wildcards place in any set, are ₹0, never payable. The bank zone therefore never
lights for a wildcard — the drop map is derived from `legalActions`, so this holds by construction,
not by a hardcoded rule. **Flag:** an early Phase-B drop-map draft called dual wildcards "bankable";
the frozen engine says otherwise and wins — the UI follows `legalActions`.

### Draw model conversion (L4)

Auto-draw replaces draw-by-pile-tap — the sole zero-choice tap left in play. The pile becomes
display + the under-pile discard destination. End turn stays always-manual (wildcard moves are
free and wins must be declared, so a turn never auto-ends).

*End of A10 (Phase B amendment).*

---

## Unchanged and still binding from v1.0 / STATE_MATRIX

Turn flow rhythm (§8), motion timings (§9), sound/haptic map (§10), error-prevention
(§11), no-tutorial discoverability + three one-time hints (§12), accessibility &
settings (§13), performance (§14), acceptance criteria (§15), and the full situation
matrix (STATE_MATRIX §2) with its six VERIFY rows still to be engine-confirmed before
screens. Munshi (advisor, 3/game, shared bot brain) is built and specced.

---

## For the builder, when M4b starts

1. Resolve the six STATE_MATRIX VERIFY rows from engine source (read-only) first; then
   finalise any A8 wording they touch.
2. Build screens in the A3 order; each PR names the spec section + matrix rows it
   implements. The Learn screen (A8 + A9 decks) is M4d scope but its content is final
   now — no copywriting during build.
3. Stand up `tokens.test` before the first screen.
4. Cross-check every A9 salah against the shared bot evaluation; mismatches go to the
   owner, never silently reworded.
5. Any new situation not in the matrix → owner decision + DECISIONS.md, never an ad-hoc
   fix.

*End of amendment.*

---

## A12 — Owner playtest refinements (30 Jul; appended, existing sections unchanged)

Four rules the owner's first playtest added. Each is implemented and captured
(`docs/captures/playtest-fixes-1/`); the others (F4 real-cards, F5 opponent row, F7 why-lines) are
polish within existing sections and live only in DECISIONS.md.

- **F1 — hand-fan scrub + no-clip law.** The fan NEVER clips: every card's rotated box stays inside
  the frame (≥8px side padding), tilt is capped at |5°|, and cards shrink for a dense hand rather
  than spilling (pure `fanLayout`, unit-tested). Interaction is a SCRUB: a finger glides over the
  fan; the card under it peeks up clear of its neighbours; sliding re-targets; lifting ~40px above
  the band turns the peek into the A10/L3 drag; a release in the band taps (stages, A1). Discard mode
  uses the same fan + peek. The ~90ms peek ease is M4c.
- **F2 — auto end-of-turn (an A10/L4 refinement).** When the human seat's `legalActions` is EXACTLY
  `[END_TURN]` — no play, no DECLARE_WIN, no free REARRANGE_WILDCARD — the UI ends the turn itself
  after an ~800ms beat with a ticker line ("Turn over — <name> plays."), and hides the manual button.
  When anything else is legal, End turn stays MANUAL (a declarable win or a free wildcard move is
  never eaten). Over the hand limit, the auto END_TURN flows into the A8/A9 discard step exactly as a
  manual one would.
- **F3 — payment default + money-first disclosure (L6).** The pre-selected DEFAULT never overpays
  when an exact selection exists, and prefers money (fewer properties). Disclosure: money notes are
  always shown; the default's own property stays shown; every OTHER property set hides behind one
  quiet "Pay with property instead" expander (collapsed), so a money-covered debt reads as money
  only. Must-pay-all (table ≤ debt) shows everything, locked. Manual edits + the "no change given"
  warning are unchanged.
- **F6 — game-end overlay + the no-scroll law at end.** Any game end (human SAUDA! or a bot win)
  presents ONE full-screen overlay: dimmed felt, a centred tokens panel (title, the winner's three
  completed-set banners, a tokens New game control), board asleep behind. It is `position: fixed` —
  never in flow — so it can't grow the page (the old in-flow winner strip was the end-state scroll
  bug). The A2 no-scroll law now explicitly holds through the end state.

*End of A12.*
