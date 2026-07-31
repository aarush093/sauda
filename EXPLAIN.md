# EXPLAIN — interview crib sheet

Plain-English notes on the key design decisions per milestone. Read top-to-bottom to explain the codebase.

## M0 — Scaffold

- **It's a pnpm monorepo.** `pnpm-workspace.yaml` declares `packages/*`, `apps/*`, `tools/*`. Only `packages/engine` exists so far — the rules engine, the one source of truth for the game. Other packages are added in the milestone that needs them, so nothing is empty/dead.
- **TypeScript is strict, deliberately hardened.** `tsconfig.base.json` turns on `strict` plus extras: `noUncheckedIndexedAccess` (array access is `T | undefined`, forcing us to handle gaps), `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`. The engine is the project's spine, so I want the compiler catching mistakes from day one.
- **Structure vs. text is split on purpose.** `types.ts` holds the *structural* identity — the set keys (`mumbai`, `jaipur`…) and action keys (`kabza`…) that never change. `theme.ts` holds *everything a player reads* (game name, street names, card names, flavour). A rebrand is a one-file edit of `theme.ts`; because IDs come from the structural keys, no rebrand can ever change an ID.
- **Card IDs are theme-independent.** Every card's ID is `<category>_<structuralKey>_<index>`, e.g. `prop_mumbai_0`, `action_kabza_1` (`deck.ts`). They're built only from structural keys + a counter, never from a display name. This matters because M4 persists the game across app kills keyed by ID — deriving an ID from "Marine Drive" would mean a text edit silently corrupts saves. Two tests lock this down: one checks the ID shape, one asserts no ID contains any human-facing string from `theme.ts` (except strings that happen to equal a structural key, like the label "Mumbai" vs the key `mumbai`).
- **The deck is data, not code.** `theme.ts` lists the sets, wildcards, actions, kiraya and money with their counts; `deck.ts` just loops over that data to build 106 typed cards. `deck.test.ts` is the M0 gate: exactly 106 cards, the exact 28/11/34/13/20 breakdown, and money summing to ₹57 Cr. If the deck drifts, every later probability is wrong, so it's pinned hard.
- **Determinism is enforced, not hoped for.** `rng.ts` is a seeded PRNG (mulberry32) + Fisher–Yates shuffle: same seed ⇒ same game, which we need for replay, debugging and ML later. `Math.random` is *banned in the engine* by an ESLint rule (`no-restricted-properties`), so the guarantee can't be broken by accident.
- **An IP guard protects originality.** SAUDA is an original expression of a public genre. `ip-guard.test.ts` walks the *whole repo* and fails if any third-party name appears, so `apps/`, `tools/` and the `store/` listing are covered automatically as they're added. Exactly two files are allowlisted (`CONTRIBUTING.md`, `docs/BUILD_SPEC.md`) because they legitimately quote the banned words as the guardrail spec. The banned terms are assembled from string fragments so the guard file itself scans clean.
- **The toolchain is pinned for reproducibility.** `packageManager: pnpm@11.17.0`, `engines.node >=24.15.0 <25`, and `.nvmrc` mean the repo builds identically on another machine months later. `pnpm run verify` (= `pnpm -r typecheck && pnpm -r test`) is the green-before-advancing gate; CI runs the same two commands.

## M1 — Engine

- **It's an event-sourced state machine.** `reduce(state, action) → Result<{state, events}>` is the ONLY thing that changes state (`reduce.ts`). It clones the state, mutates the clone, and returns it with a list of `GameEvent`s. Illegal actions come back as a `RuleViolation`, not an exception. `legalActions(state, playerId)` returns the exact set of moves a player may make — the UI renders only those and bots pick only from those, so illegal states can't be reached.
- **One registry, IDs everywhere.** All 106 cards live once in `state.cards`; every zone (hand, bank, each colour group, draw/discard, and cards mid-flight in an interrupt) stores only IDs. So the headline invariant — exactly 106 cards, each once — is a cheap set check (`checkInvariants`), run after every reduce in the property tests.
- **The interrupt stack + NAHI parity is the cleverest bit.** A charge/steal doesn't apply immediately: it becomes a frame on `pendingInterrupts` and opens a response window; while a frame is open, ONLY that frame's `responder` has legal moves, which freezes the turn and is exactly how off-turn NAHI CHALEGA works. NAHI cards accumulate in the frame, and the charge stands iff an EVEN number were played (parity). I proved parity equals the spec's literal last-in-first-out stack for chain depths 0–4 (`interrupts.test.ts`), and logged it in DECISIONS.md — because I need to defend "counting instead of unwinding a stack" in an interview.
- **Payment is the subtle rules bit (§4.5).** The payer picks table cards only (never hand), no change is given, and if the table is worth less than the debt you hand over everything. The ANY wildcard is worth ₹0 and never payable. Paying a property can break your set and relocate its building to your bank. Buildings themselves are payable (a decision I logged): paying one leaves the set complete but stripped. `validatePayment` is permissive (any selection ≥ debt is legal); `suggestPayment` is the one shared helper that always minimises overpay, so bots never overpay by accident.
- **legalActions has exactly one deliberate gap.** Enumerating every legal payment SUBSET is exponential, so for a payment window `legalActions` returns a single suggested `RESPOND_PAY`, and `reduce` validates whatever subset the caller submits, with a distinct error code per §4.5 failure. This is the one place `legalActions` isn't a full enumeration — logged in DECISIONS.md so I can explain why.
- **Determinism is baked in.** The RNG is a single integer stored in the state (`rngState`), advanced by a pure step function, so shuffles and mid-game reshuffles replay identically from the seed and the whole state can be saved/resumed (M4). No `Math.random` in the engine.
- **Testing is the spine.** All 20 named edge cases have unit tests; a fast-check property test drives 500 random full games and asserts every invariant (106 conserved, no card returns to a hand, plays ≤ 3, empty interrupt stack at turn boundaries, hands within limit, termination < 500 turns). 10 curated JSON fixtures are exported to `packages/engine/fixtures/` as the M6 Python parity gate.

## M2 — Bots + CLI

- **Two bots, one interface.** Every bot implements `chooseAction(observation, legalActions, rng)`. `RandomBot` picks a uniformly random legal move (great for stress-testing the engine). `HeuristicBot` is a readable rule-based player with three difficulties. Both consume only the hidden-info `Observation` and the engine's exact `legalActions` — they never see or re-derive raw state.
- **The heuristic is a race-to-3-sets.** In priority order: complete a set for free by rearranging a wildcard → a placement that completes a set → KABZA a whole opponent set → HAATH KI SAFAI a single property that advances one of my sets → place toward the cheapest (size-2) sets → dig for cards with AAGE BADHO → play a charge only when the expected take beats banking the card → build MAKAAN/HAVELI → bank a cash reserve. A smart discard keeps property/wildcards and drops spare money first.
- **Payment is delegated, not reinvented.** The bot never builds a payment itself — it returns the single `RESPOND_PAY` that `legalActions` already filled from the engine's shared `suggestPayment`. A test asserts the bot's choice is identical to `suggestPayment`. This is the "one tested way to pick cards" the M1 design promised, now consumed for real.
- **`suggestPayment` got smarter (still shared).** It still minimises overpay first, but now breaks ties by damage — pay with cash before property, and never break a complete set unless forced. This one change (in the engine, so bots *and* the M3 UI benefit) noticeably raised win-rate because the bot stops shattering its own sets to pay rent.
- **The driver + simulator.** A single loop figures out whose move it is (interrupt responder or turn player), asks that bot, applies it with `reduce`, and checks invariants after every step. The simulator runs 1000 seeded HeuristicBot(Medium)-vs-RandomBot games and enforces the §8.3 gate: **zero invariant violations across all games**, ≥90% win, ≤25 avg turns. Measured: **95.0% win, 20.6 avg turns, 0 violations**.
- **The CLI.** `pnpm play` is a readable terminal game — one human vs three bots — where the menu is built straight from `legalActions`, so it can only offer legal moves (the same guarantee the mobile UI will use in M3). `--auto` plays every seat with a bot and prints a full transcript; a demo game finishes with a real winner in ~22 turns.

## M3 — Mobile core (web)

- **It's a Vite + React 18 app, deliberately plain.** M3 is functional plumbing only — clean, legible, no theme styling. The visual identity, fonts, the stamp-slam signature, motion and sound are M4 (designed on purpose, not auto-generated). Android packaging is M5.
- **The store is a thin shell over the engine — no rules in React.** `dispatch(action)` is literally `reduce(state, action)`; `stepBot()` asks a `HeuristicBot` to choose from `legalActions`; the board renders `observe(state, seat)`. If I ever needed to know "is this legal?" in a component, I ask the engine — never re-implement. `labels.ts` only turns ids/actions/events into readable strings from the theme.
- **Every button is a legal action.** The action panel maps `legalActions(state, actor)` to buttons, grouped by the hand card they use, so the UI can only offer legal moves. Interrupt responses (NAHI CHALEGA, allow, pay, place-received) show up as response buttons; payment offers the engine's `suggestPayment` selection.
- **Hidden information is respected in the UI too.** The board is built from an `Observation`, so opponents show only hand counts and the draw pile shows only a count.
- **Pass-and-play privacy.** A hand-off overlay covers the board when it's a *different* human's turn, until they tap "ready"; solo games skip it. Bots play themselves on a 300 ms timer so you can watch the board change.
- **How M3 is verified.** A headless integration test drives complete solo and pass-and-play games through the real store to a winner and asserts **zero console errors**; the App renders in jsdom; the production `vite build` succeeds. Same engine, same `legalActions`, from CLI to web.

## Rules clarifications (win + set overflow)

- **The win needs three DIFFERENT colours.** `hasThreeCompleteSets` counts *distinct complete colours*, not total complete sets. Two complete jaipur sets plus one mumbai set is three sets but only two colours — not a win. (This was implicit before, because each colour had exactly one group; the overflow change below forced it to be explicit.)
- **A colour can hold more than one set (overflow).** `properties` went from one group per colour to a *list* of groups per colour (`Record<SetId, PropertyGroup[]>`). When you place a card into a colour, it fills the first non-full set, and if that set is already full it starts a **second** set of that colour — surplus never overfills. This only happens via wildcards (e.g. 3 real + 2 wildcards in a size-3 colour).
- **Each set is scored on its own.** Completion counts complete groups (so a second same-colour set is a real "set" for stats), rent is charged for your *best single set* of a colour (never summed across two), buildings sit on a specific complete set, and KABZA steals one complete set. The one place all this rolls back up to a colour is the win check — where it's colours, not sets, that matter.
- **The bots understand it too.** The HeuristicBot won't build or steal toward a colour it has already completed, because a second same-colour set can't get it closer to three colours. The 1000-game gate still passes (95.8% vs Random, 20.3 avg turns, 0 invariant violations).

## M4a — Deed Card live layer

- **The card is two layers.** `CardFace` draws a static art *plate* (a raster painting when one exists, else a text-free SVG fallback) with a *live layer* on top — every number, name and icon that means something, rendered by code from engine/theme data. The plate gives the look; the live layer guarantees correct values and crisp text at any size. This is why the same component works for all 106 cards at three sizes with one zone contract.
- **Only the engine's data changed.** The one permitted engine edit was cosmetic: new `SETS` ink hexes and two presentation-only fields (`works`, `est`) that feed the vintage factory footer. No rule moved.
- **Fonts are bundled and offline.** A dev-only script fetches *text-subset* woff2 once (only the glyphs we render, including "सौदा"), so all five faces total 55.9 KB. The app loads them from local files via `@font-face` — never a CDN at runtime.
- **Art can arrive later without code changes.** `CardFace` looks up `assets/plates/{cardId}.webp`; until a plate exists it shows the fallback. The `/dev/plates` sheet lists every face × FULL/MID/CHIP and tags plate-vs-fallback, so dropping in a painting just flips the tag.
- **Verified:** every distinct face renders at all three sizes without throwing, the live layer shows the right engine values (e.g. mumbai FULL SET = ₹8), `verify` + lint green, production build bundles the fonts locally.

## M4b — Play screen (Phase B)

- **The Munshi chip is a read-only advisor that shares the bot's brain.** A small gold token by my avatar (three pips = three consults per game, flat, no carry-over) opens a "Munshi ki Salah" card showing the move the *bot's own* `recommend()` would pick plus one templated reason line. The point is it can never out-think the bots or diverge from them — it calls the identical function. Crucially it is **read-only**: opening it dispatches no engine action (the engine state object is literally unchanged across a consult), so it advises but never plays — the player still makes the move themselves. While it's open it is the single live surface (a scrim sleeps the hand, rail and any sheet — law L2); it appears only on my own play turn with legal moves, and a spent budget renders the chip inert. The 3-use budget lives in the store so it resets each game and never carries over.

## M4b — Owner playtest 2 ("real cards, real wheel")

- **Tap = inspect, drag = commit (the core input change).** The owner, playing live, read the old
  "tap a card → it stages with a Bank/Play button rail" as the game *asking permission*. So the rail
  is gone from the hand: **tapping a hand card now just INSPECTS it** — it floats up large and
  readable with no buttons and can never dispatch an action. The ONLY way to play a card is to **drag**
  it (from the wheel, or from the inspected card) onto a glowing zone. If a card's canonical play is
  currently illegal, inspect shows one greyed why-line ("needs a complete set") so the rule teaches
  itself. On-board picks (targeting, payment, discard, expanders) stay taps — those are choices, not
  a permission rail.
- **The hand is a half roulette wheel, and its whole correctness lives in one pure function.**
  `wheelLayout(n, width)` returns each card's position + spoke angle; the component just renders it.
  The one hard invariant — the readable top strip of every card stays inside the frame while the
  bottoms disappear off the screen edge — is *proven* by a unit test that reconstructs each rotated
  card's corners for n = 1..12 at both real board widths, not eyeballed. When the hand size changes
  the cards **glide** to their new even spacing via a single transform-only transition (the one bit
  of motion allowed in M4b); the transition sits on an *outer* layer (position + angle) while the
  scrub "peek" sits on an *inner* layer with no transition, so the peek stays instant and only the
  redistribution eases.
- **"Real cards everywhere" is enforced by deleting the alternatives.** Previously a card could be
  drawn three ways: the full face, or a symbolic "MID" (colour banner + pips), or a "CHIP" (a letter).
  The owner's non-negotiable was that his handcrafted faces show *everywhere*. So MID and CHIP were
  **deleted outright**, along with the `size` prop — now there is exactly one face, and `ScaledCard`
  shows it smaller by CSS-scaling the *same* full render. A table set is a cascade of overlapped real
  cards; tapping any opponent row (or my own group) expands it to a full-screen readable table view.
- **The F4 regression was a "looks like it's fixed" trap.** A prior pass claimed "real cards
  everywhere" and even noted "the payment sheet already renders CardFaces". It did call `CardFace` —
  but with `size="mid"`, the *symbolic* variant. The lesson: "calls the right component" ≠ "renders
  the right thing"; the fix had to remove the symbolic code path entirely, not add another caller.
- **Received cards land where you can act on them.** When a wildcard is paid to me it used to pop a
  separate button-list dialog. Now it lands on the centre stage and my legal destination sets glow on
  the real board — I drag it home (or tap a glowing set). This reuses the exact same drop-zone
  machinery as a normal play, so it's the same gesture, not a special case.
- **Nothing in the engine moved.** Every change is presentation over `legalActions`: the wheel, the
  inspect view, the cascades, the table view, the received-on-stage flow all derive from the engine's
  already-enumerated moves. `packages/engine` and `packages/bots` stayed byte-identical across all
  seven fixes.

## M4b — excellence pass (H): evidence, geometry, performance

- **End turn was floating over the wheel.** The half-roulette wheel spans the full width and its
  cards splay their readable tops across the upper band; a button pinned to the bottom-right corner
  overlapped those tops for most hand sizes (measured n=5..12) AND blocked scrubbing them. The fix is
  a geometric one: move the control to the my-area header, a band the wheel never reaches — proven by
  a pure-geometry unit test (no card's rotated box enters the header slot at any n). SPAN_MAX stays
  120 so the wheel keeps its full spread.
- **The wheel can only get so big.** Card legibility is bounded by the my-area height: the on-board
  set cascades take ~half of it, leaving ~142px for the wheel. So the only lever is the hub depth —
  a shallower hub makes the band shorter for a given card, buying a slightly wider card. The banner
  text is measured in DEVICE pixels (CSS font × the card's transform scale × devicePixelRatio); at
  DPR2 the set-name reads at ~9.4px, but the tiny locked value badge can't reach 10px without a card
  so large it would scroll the screen — an honest flag, not a silent miss.
- **A drag used to re-render the whole board.** Drag state lived in the board, so every pointermove
  re-rendered every placed card. `React.memo` on the card face (it depends only on its id) drops that
  from ~216 renders per drag to ~2 (just the dragged preview) — the board's cascades skip entirely
  because their props are stable mid-drag. Frame times under a 4× CPU throttle fall back inside the
  60fps budget.
- **A GC bug was cancelling the plate preload.** Preloading an image is `new Image(); img.src = url`,
  but if you don't KEEP a reference the Image can be garbage-collected before the fetch finishes,
  cancelling it — which is why some plates still fetched mid-game. Retaining the refs fixes it; all 45
  plates load once at start, zero mid-game fetches. We fetch (cheap) but let decode stay lazy — a full
  decode of all 45 would be ~90MB, too much for a budget device.
- **Bot pacing is one small table, not a flat delay.** A flat 700ms/beat made the wait between my
  turns 4-10s. The new rule — first beat 700, later beats 450, floor 350, trimming near a ~3s cap —
  is a pure function you can read in four lines and unit-test; it cut the median wait to 3.45s and the
  p95 to 7.55s while still showing every card.
- **Evidence over assertion.** Anything that moves is proven by a committed `.webm` clip recorded from
  the real UI; every number (px sizes, frame times, overlap n-values, inter-turn waits) comes from a
  rerunnable measurement script, not a claim.

## M4b — close-out pass (J): finish the flags, ship to the phone

- **A "one-frame transition" hitch is a mount/paint cost, not a design problem.** Two interactions
  breached the 33ms ceiling in their *worst* frame (not their p95). Rather than guess, I made the
  profiler print a per-interaction render tally. It showed the culprits exactly: opening the expand
  view painted 16 big card faces in a single frame, and *committing any play* re-rendered ~44 set
  cascades. Naming the cost is 90% of fixing it.
- **Memoisation only works if the compared value is stable.** The cascades re-rendered on every commit
  because the engine hands back a fresh `Observation` — new `PropertyGroup` objects — each dispatch, so
  a by-reference `React.memo` always saw "different". Switching to a *content* comparator (same card
  ids? same buildings?) means an untouched set skips the render entirely: banking a card now re-renders
  **0** cascades instead of 88. This is the whole trick — compare what actually changed, not the wrapper.
- **Spreading a mount across frames: the empty first frame matters.** The expand view now reveals one
  group per animation frame. The non-obvious bit: it must start from **zero** groups, because the first
  frame is already the expensive one (it does the board re-render + the backdrop-blur setup). Letting
  even one card ride that frame kept it at 66ms; deferring *all* cards to frame 2+ dropped it to 17ms.
- **`srcset` can't help when you scale with a transform.** Every card is drawn at 132px then
  `transform: scale()`-ed down, so the browser only ever sees a 132px `<img>` box — it can't pick a
  smaller source itself. So the component that knows the *real* on-screen width passes it down as an
  explicit hint, and a pure function picks the smallest pre-built tier that covers width×DPR. A 14px
  board card stops pinning a 2MB 600px bitmap; decoded board memory falls **52MB → 4MB**.
- **The build step that never touches the source.** A tiny sharp script derives 160px + 320px webp
  variants of all 45 plates into a `variants/` folder. The originals are the source of truth; the
  variants are pure build outputs (regenerate any time). Vite's `import.meta.glob` picks them up with
  zero config, and if they're missing the runtime just falls back to the full plate — nothing breaks.
- **A legibility floor is the map-label trick.** Below the size where the value badge's numerals would
  drop under 10 device px, the badge stops shrinking and instead *grows* relative to the card, anchored
  at its corner — exactly how a city label on a map stays readable as you zoom out. It's a pure
  function of (face scale, DPR), it's a no-op at full size (so the big card is byte-identical, proven by
  a screenshot hash), and it ships behind a default-off toggle because it's the owner's aesthetic call.
- **Fingers, not a mouse.** Every playtest was mouse + devtools, but the input model is touch. The
  audit found the gestures were already pointer-events (so touch works), but one affordance was
  *cursor-only* — my own sets were tap-to-expand with only a hover cursor + tooltip to say so, invisible
  on a phone. Same fix as the opponents got: a visible ⤢ glyph. Then `vite --host` + a terminal QR puts
  the build on the real phone (with a USB `adb reverse` fallback for wifi that isolates clients).
