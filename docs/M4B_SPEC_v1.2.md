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

## A4 — Wildcards are UNIVERSAL (rules change shipped, `4055711`)

All 11 wildcards place on ANY set (`placeableSets` returns every set). Each keeps its ₹
value badge and is bankable. **Card face:** every wildcard renders the same unmistakable
**all-colours (rainbow) band** — no two-colour splits. A wildcard must never visually
imply a restriction the engine doesn't enforce. Re-sim confirmed balance held
(95.7% win / 20.1 turns).

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
A wildcard joins ANY colour set and carries a ₹ value (it can be banked or paid). On
your own turn, moving a placed wildcard between your sets is free.

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
