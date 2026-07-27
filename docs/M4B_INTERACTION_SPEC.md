# M4B_INTERACTION_SPEC — The SAUDA Play Environment
**v1.0 · Owner-approved · Consumed by: M4b (screens), M4c (motion/sound), M4d (meta)**

---

## 0. Purpose and prime directive

This spec defines how SAUDA *feels to touch*: the table, the hand, every gesture, every
transition, every piece of feedback. It is the interaction-side twin of
`M4_DESIGN_SPEC.md` (which owns how cards *look*).

> **Prime directive: players learn SAUDA's rules, never SAUDA's app.**
> Every interaction must already exist in the muscle memory of anyone who has played
> polished mobile card games. Innovation lives in the mechanics only. Whenever a choice
> exists between a novel interaction and a proven one, the proven one wins — always.

The patterns below are distilled from the interaction conventions shared by the most
polished digital card games (drag-to-play hand fans, arrow targeting, bottom-sheet
pickers, mana-pip resource counters, non-blocking turn banners). They are recorded here
as *decisions*, not research tasks — the builder implements this spec; it does not
re-derive it.

**Repo hygiene:** this file must never name other publishers' trademarked game titles
or the banned terms guarded by `ip-guard`. Reference images used by the owner stay
outside the repo.

---

## 1. Non-negotiable laws (condensed for SAUDA)

1. **One finger does everything.** No multi-touch, no keyboard, no hover-dependence.
2. **Every gesture is reversible until commit.** Drag back = cancel, always. Only
   irreversible game events (confirming a payment, declaring the win) get an explicit
   confirm — and never a popup for anything else.
3. **Interactive things look interactive.** The single source of truth is the engine's
   `legalActions`: a card/zone glows *iff* a legal action involves it. Nothing else ever
   glows. Recognition over recall.
4. **Nothing blocks thinking.** No modal tutorials, no forced popups, no animation that
   locks input. Banners and sheets are non-blocking or dismissible. Input is accepted
   during animations; visuals catch up.
5. **Cards are the heroes.** The chrome disappears: one background, one accent, quiet
   type. The table is a stage, not a dashboard.
6. **The hand is always readable.** No hidden cards, no tiny cards, no awkward scrolls.
7. **Touch is forgiving.** Minimum 48×48 dp targets; drop zones accept near-misses;
   ambiguity resolves toward the likeliest legal intent (never toward an illegal or
   unfair outcome).
8. **Feedback within one frame.** Touch → lift/scale/shadow immediately; sound and
   haptic ride on top. Invalid → gentle shake + dim, never a dialog.

---

## 2. The stage — visual environment

Calm by discipline, not by emptiness.

| Token | Value | Role |
|---|---|---|
| Table felt | deep indigo `#1B1E42` | the one background, everywhere in play |
| Card cream | `#F2E9D2` | the heroes; nothing else may be this bright at rest |
| Accent (single) | gold `#E8B84B` | turn indicator, legal-action glow, focus ring |
| Danger/stamp | stamp red (existing token) | KABZA/win stamp, destructive confirm only |
| Text on felt | cream at 85–90% opacity | labels, totals |

Rules of calm:
- **One accent.** Gold means "yours to act on." Nothing else pulses, shimmers, or
  gradients. No particles outside the stamp moments (M4c).
- **Set colours appear only on cards and their group markers** — never as UI chrome.
- Elevation is soft and small (2–8 dp shadows); the vintage-paper world has weight, not
  neon.
- Empty states invite: an empty property area shows a faint deed outline + "Place your
  first deed", not a blank void.
- Type: existing stack only (Baloo 2 display · IBM Plex Mono numerals · serif
  sublabels). Sentence case everywhere; buttons say exactly what they do ("Pay ₹4 Cr",
  "End turn"), and the same verb follows the action through toasts.

---

## 3. Table anatomy — portrait, one screen, zero scrolling in play

Portrait-only for v1 (matches one-hand play and pass-and-play). All play states fit one
screen; only sheets (payment, discard, hand-off) slide over it.

```
┌──────────────────────────────────────┐
│ OPPONENT STRIP (per opponent, 1–3)   │  avatar · name · hand-count pips ·
│  [bank total] [set stacks ▪▪▪]       │  bank ₹ · property groups as mini
│                                      │  colour stacks with count badges
├──────────────────────────────────────┤
│ CENTRE BAND                          │  draw pile (count) · discard (top
│  [draw] [discard]   TURN CHIP        │  card visible) · whose-turn chip
├──────────────────────────────────────┤
│ MY TABLE                             │  property groups as colour columns
│  [group][group][group][+ ghost]      │  (full CardFace, stacked w/ offset)
│  BANK: chip-stack  ₹ total           │  bank as a compact money stack
├──────────────────────────────────────┤
│ PLAYS ●●○   MY HAND (fan)     [End]  │  3 play pips · fanned hand ·
└──────────────────────────────────────┘  End-turn button (right thumb)
```

- **Opponent strip** rows are tappable → expands in place (pushes centre down, does not
  navigate away) to full-size readable groups. Tap elsewhere collapses. In 2-player,
  the strip is taller by default and mostly pre-expanded.
- **Turn chip** sits centre: gold ring + name when it's you ("Your turn · 3 plays"),
  quiet cream text for others.
- **Draw pile** shows remaining count; **discard** shows its top card face.
- **My table**: each colour group is a slightly fanned vertical stack; a complete set
  wears a small gold "FULL" ribbon. A dashed **ghost slot** appears at the end of the
  row *only while dragging* a property that could start a new group.
- **Bank** is one compact overlapping stack + a mono ₹ total. Tap → expands in place to
  count the notes.
- **Plays pips** (●●○) live beside the hand — the resource counter every card gamer
  reads instantly. They refill on turn start with a tiny pop, and one dims the moment a
  play is committed.

---

## 4. The hand

- **Fan:** bottom-centre arc, cards overlapping ~55%; every card's value badge and name
  band must stay visible at rest. Up to 7 cards needs no interaction to read; 8+
  (pre-discard) compresses the fan slightly, never scrolls.
- **Browse:** touch down on the fan and slide sideways — the card under the finger
  lifts ~24 dp, scales to ~1.15×, neighbours part. Release without dragging up = simple
  deselect. (This is the universal fan-browse; ship it exactly.)
- **Inspect:** tap a card → it rises and enlarges to readable size above the fan
  (still in context, table visible). Tap elsewhere → returns. Long-press anywhere a
  card exists (hand, table, opponent expanded view, discard top) → full-screen zoom of
  that card; release ends it. One gesture, everywhere, for "let me read this."
- **Legality at a glance:** cards with no legal action right now (off-turn, 0 plays
  left) rest at ~70% saturation; legal cards are full colour. On your turn the fan is
  simply *alive*; off-turn it visibly sleeps. Exception: a card that can legally
  interrupt off-turn (NAHI CHALEGA) stays awake and gently glows when an interrupt
  window opens.

---

## 5. Playing a card — the drag model

**Drag is the primary verb.** Lift a card ~32 dp out of the fan and the app enters
*play mode*: the hand dips back 10%, the felt dims 8%, and **every legal drop target
for this card glows gold**. Release over a target commits; release anywhere else — or
drag back to the fan — cancels with a soft glide home. Nothing commits on tap alone.

Drop targets by card kind (derived from `legalActions`, never hardcoded):

| Card kind | Glowing targets | On-hover label (appears over target) |
|---|---|---|
| Money | My bank | "Bank ₹N Cr" |
| Property | Its colour group (or ghost slot for a new group) | "Place · <city>" |
| Wildcard | Every group it can join + ghost slot | "Place as <colour>" |
| Action | **Two targets:** centre PLAY zone *and* my bank | "Play <NAME>" / "Bank ₹N Cr" |
| Kiraya | Centre PLAY zone (then targeting if needed) *and* bank | "Charge kiraya" / "Bank ₹N Cr" |

- The **action/bank duality** is SAUDA's biggest novel decision point, so it uses the
  most familiar possible pattern: two clearly-labelled drop zones. The label under the
  finger states the meaning *before* release — no surprises, no confirm dialog needed.
- **Banked actions are money forever** — the drop label on the bank zone for an action
  reads "Bank ₹N Cr" and, on first-ever such drop, a one-line inline hint appears under
  the bank for 3 s: "Banked actions stay money." (Hint shows once per install; that is
  the entire tutorial system — see §12.)
- **Targeted actions** (KABZA, VASOOLI, ADLA-BADLI, DUGNA, kiraya vs one player): drop
  on PLAY → the card plants centre-table and an **arrow** grows from it under the
  finger; legal targets (an opponent's full set, a player chip, a property) glow; the
  arrow head snaps to the nearest legal target within ~64 dp. Release on a target =
  commit; release on nothing = the card glides back to hand, play refunded. Arrow
  targeting is the single most-trained gesture in digital card games — implement it
  faithfully, including the snap.
- **Wildcard rearrangement** (free action, own turn): drag a placed wildcard directly
  between your groups; ghost slot appears; drop commits instantly, no play consumed,
  pips untouched. A wildcard that cannot legally move right now simply doesn't lift.

---

## 6. Payments — the bottom sheet

Trigger: any event where a player owes (kiraya, VASOOLI, SHAGUN…).

- A **bottom sheet** slides up ~60%: title states the whole story in one line —
  "Pay ₹4 Cr to Meera". The table (and the demanding card) stays visible above it.
- Sheet contents: my bank notes and my table properties as tappable CardFaces. Tap =
  select (gold ring + lift), tap again = deselect. A **running meter** fills toward the
  demand: "₹3 / 4 Cr" → "₹5 / 4 Cr · no change given" (the no-change rule is surfaced
  exactly at the moment it matters, nowhere else).
- **Pre-filled suggestion:** the sheet opens with the engine's `suggestPayment` already
  selected (the same damage-aware helper the bots use — never breaks a complete set
  when an alternative exists). The commit button reads "Pay ₹4 Cr" and is one tap away.
  Modify freely; the suggestion is a starting point, not a lock.
- Underpayment is only possible when the engine says it is (nothing left to give);
  then the button reads "Pay all I have".
- Commit animates the chosen cards flying to the recipient's areas. **This is the one
  flow with an explicit confirm, because it is irreversible** — the confirm *is* the
  pay button; there is no second dialog.
- The payer cannot be soft-locked: the sheet has no close-X while a debt is pending,
  but the table behind stays inspectable (long-press zoom works through it).

---

## 7. Interrupts — NAHI CHALEGA

The engine's parity-based interrupt stack surfaces as one calm moment, not a scramble:

- When an action lands that the defender could cancel, the flow pauses on a compact
  centre prompt attached to the played card: "**KABZA played against you**" with two
  buttons: "Nahi chalega!" (only if they hold it — the card itself glows in their fan)
  and "Allow". A slim 10 s ring drains around the prompt; timeout = Allow. No full-
  screen takeover; the table stays visible so the stakes stay visible.
- Chains (cancel-the-cancel) reuse the identical prompt with the parity result stated
  plainly afterwards in the log line ("KABZA stands" / "KABZA cancelled").
- **Pass-and-play privacy:** the prompt appears only after a hand-off interstitial
  ("Pass to Meera — tap when only Meera can see"), so holding or lacking the counter
  is never leaked to the table. Bot defenders decide instantly with a 400 ms beat so
  the human can read what happened.

---

## 8. Turn flow — the rhythm

Observe → select → commit → resolve → recover. The game always answers "what happens
now?" before the player asks.

- **Turn start (you):** non-blocking gold banner slides through ("Your turn"), pips
  refill, 2 cards fly from the draw pile into the fan with a soft riffle (5-card refill
  animates the same way, slightly faster per card). Total ceremony ≤ 900 ms and input
  is live throughout.
- **During:** every commit dims a pip and appends one line to a 2-line **event ticker**
  under the centre band ("You placed Hawa Mahal Road" / "Arjun banked ₹3 Cr"). The
  ticker is the passive narrator; tap it to unroll the recent history sheet.
- **Bot turns:** each bot play resolves with a 500–700 ms beat and the same animations
  a human would cause — bots must be *watchable*, never instantaneous state teleports.
  The active bot's strip row carries the turn chip.
- **Turn end:** "End turn" (thumb-right, always in the same spot) is enabled whenever
  ending is legal. With plays remaining it asks nothing — pips make the tradeoff
  visible. If hand > 7, tapping it enters **discard mode**: the fan lifts, a counter
  reads "Discard 2", tapped cards fly to the discard pile; the same button (now
  "Done") finishes. Reversible until Done: tap a discarded-this-turn card on the pile
  to take it back.
- **Win:** the engine detects; the UI declares only on the winner's own turn — the
  final placement resolves, half a beat, then the M4c stamp-slam ("SAUDA!") over the
  table, then the results screen. Never interrupt an opponent's turn with a win.

---

## 9. Motion language

Animation explains — origin, destination, cause, cost, change. Anything decorative
gets cut. Cards are paper with weight: ease-out-cubic arrivals, slight overshoot
(1.02×) on landings, never linear, never snappy-harsh.

| Moment | Duration | Notes |
|---|---|---|
| Touch acknowledge (lift/scale/shadow) | ≤ 1 frame start, 120 ms settle | on everything touchable |
| Fan browse neighbour-part | 90 ms | follows the finger, no lag |
| Card travel (hand→table, pile→hand, pay) | 240–320 ms | arc trajectory, not straight lines |
| Drop-zone glow in/out | 150 ms | opacity+ring, no pulsing loop |
| Sheet in/out | 260 ms | standard bottom-sheet physics |
| Turn banner | 600 ms through | non-blocking |
| Invalid shake | 3× 40 ms, 4 dp | with dim, no sound spike |
| Stamp-slam (KABZA / SAUDA! win) | 450–600 ms | **the one big moment** — scale-drop + ink bleed + haptic thump; everything else stays quiet so this lands |

Global rules: input never waits for animation (state commits instantly; visuals queue
and catch up — an **animation queue** serialises overlapping resolutions so cause
always precedes effect on screen). Frame budget: interactions hold 60 fps on mid-range
Android; under load, drop shadows and arcs before dropping input responsiveness.
`prefers-reduced-motion` / in-app toggle: travel becomes 120 ms fades, stamp becomes a
static appear + haptic.

---

## 10. Sound & haptics (M4c wiring, mapped now)

Quiet confidence; paper and wood, no arcade bleeps. Master volume + separate haptic
toggle in Settings.

| Event | Sound | Haptic |
|---|---|---|
| Card lift | soft paper slide | light tick |
| Card place / bank | muted tap / note shuffle | light |
| Draw ×2 | double riffle | none |
| Payment commit | note count | medium |
| Interrupt prompt opens | single low string pluck | medium |
| NAHI CHALEGA played | sharp slap | medium |
| Invalid | dull thud (quiet) | light double |
| Turn start (yours) | warm chime | light |
| KABZA / win stamp | deep stamp thunk | heavy |

---

## 11. Error prevention

- Illegal is **impossible**, not punished: illegal cards don't lift, illegal targets
  don't glow, the arrow won't release on them. The engine's `legalActions` is the only
  oracle; the UI never re-implements rules to decide interactivity.
- Previews over regrets: hover labels state meaning pre-release (§5); the payment meter
  shows overpay before commit (§6); discard mode is reversible until Done (§8).
- Ambiguity bias: a release between two glowing groups snaps to the nearer; a release
  in dead space is always a cancel, never a guess.

---

## 12. Discoverability without a tutorial

The interface *is* the tutorial:

- Glow teaches what's playable; hover labels teach what plays mean; the ticker teaches
  what just happened; pips teach the economy of a turn.
- **Inline one-liners, once each, ever** (stored flags): first bank-an-action ("Banked
  actions stay money"), first wildcard placement ("Wildcards can move on your turn"),
  first interrupt window ("NAHI CHALEGA can cancel this"). One line, under the relevant
  zone, 3 s, no box, no dismiss button.
- A veteran must be able to clear their first game without reading anything. The M4d
  "Learn" screen exists on the Home menu for people who *want* it; nothing forces it.

---

## 13. Accessibility & settings

- Touch targets ≥ 48 dp; hand cards far exceed it; pips/chips get invisible padding.
- Colour never carries meaning alone: set colours pair with the set icon + name band
  (already on CardFace); the gold glow pairs with the lift; the FULL ribbon has text.
  Verify all states for the two most common colour-vision deficiencies.
- Contrast: cream-on-indigo and adaptive title ink already pass; keep every new label
  ≥ 4.5:1.
- One-handed: every in-play control lives in the bottom 60% except opponent inspection
  (a read action). "End turn" right-thumb anchored; no reach-the-top gestures required
  during a turn.
- Settings (M4b Settings screen): sound, haptics, reduced motion, left-hand mode
  (mirrors End-turn + pips), bot speed (normal / fast).

---

## 14. Performance & implementation notes

- Single play screen; sheets are overlays, not routes. State→UI is pure render from
  engine observations (already the M3 contract); the animation queue lives beside, not
  inside, the state layer.
- Card pooling: reuse CardFace instances across zones (hand/table/opponent/sheets);
  never mount 106 at once.
- Optimistic UI is unnecessary (local engine, synchronous) — but the *pattern* holds
  for M6/online later: commit visuals from local prediction, reconcile on engine ack.
- Gesture interruption: a second touch during a drag cancels cleanly (drag is one-
  finger; a palm touch must not commit anything).
- Safe areas respected top/bottom; layout scales from 360×640 up; test the fan and
  sheet on the smallest target device first.

---

## 15. Acceptance criteria (M4b/M4c exit gate)

A tester who has played mobile card games but never SAUDA, given the app cold:

1. Reads their hand and inspects a card within 10 s, unprompted.
2. Plays a property, banks money, and plays an action for its effect in their first
   turn without a wrong attempt that *commits*.
3. Cancels a drag mid-gesture instinctively (release off-target) and shows no
   confusion.
4. Completes a payment using the pre-filled suggestion in ≤ 2 taps, or edits it
   without help.
5. Survives an interrupt window understanding what was asked.
6. Never asks "whose turn is it?" or "what just happened?" — chip + ticker answer
   first.
7. Reports nothing "flashy" or "cluttered"; the only remembered spectacle is the
   stamp.
8. All of the above with sound off (visual feedback is self-sufficient) and again with
   reduced motion on.

---

## 16. Integration into the roadmap (rewrites, not additions)

- **M4b — screens** builds *this spec*: table anatomy (§3), hand (§4), drag model
  (§5), payment sheet (§6), interrupt prompt (§7), turn flow (§8), error prevention
  (§11), settings (§13). Home/Stats screens follow §2's calm rules and the copy rules.
- **M4c — juice** implements §9 timings, §10 sound/haptic map, the stamp-slam as the
  single signature, and the reduced-motion path. No new interactions may be invented
  in M4c — motion only explains what M4b built.
- **M4d — meta** adds the optional Learn screen (§12), victory share, unlocks — all
  outside the play loop; the play screen gains nothing new.
- Each M4b PR states which spec section it implements; deviations require an owner
  decision logged in `DECISIONS.md` (same discipline as the palette).

*End of spec.*
