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
- **The driver + simulator.** A single loop figures out whose move it is (interrupt responder or turn player), asks that bot, applies it with `reduce`, and checks invariants after every step. The simulator runs 1000 seeded HeuristicBot(Medium)-vs-RandomBot games and enforces the §8.3 gate: **zero invariant violations across all games**, ≥90% win, ≤25 avg turns. Measured (fresh 1000-game run): **95.8% win (958/1000), 20.27 avg turns, longest 39, 0 violations**.
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

## M4 — feel + shell pass (K): one continuous motion, and a real front door

- **Physics on top of the oracle, not instead of it.** The owner wanted a "dating-app" drag —
  choose in one motion, place in the second. I layered a spring/magnet/fling controller ON TOP of the
  existing rule that a card only commits to a zone `legalActions` already offered. The magnet only
  ever leans toward — and the fling only ever lands on — an ELIGIBLE zone, so no amount of physics can
  make an illegal move. The commit decision is still "released over a legal zone, or flung at exactly
  one." That separation is why the feel is all new but the game's legality is untouched.
- **A spring you can read aloud.** The card follows the finger with a critically-damped spring (the
  fastest follow that never overshoots — so it reads as "attached", not "wobbly"). The trick for
  stability: I integrate it in ≤8ms slices, so even a janky 32ms frame under CPU throttle can't make
  the simple `a = -k·x - c·v` explode. No closed-form magic; just a plain spring, sub-stepped.
- **Fling = fast AND aimed at exactly one thing.** A release only "flings" if it's above a
  conservative speed AND its direction points within a 30° cone of exactly ONE eligible zone. Two
  zones in the cone (ambiguous) or a slow release → no fling, normal rules. That "exactly one" rule is
  the whole safety: a flick can commit without landing on the zone, but never guesses between two.
- **The "dimmed card behind the ticker" bug was just overflow.** I measured it: a 112px stage card is
  162px tall, but the stage band is only ~117px — so the card bled 22px up into the ticker. The fix
  isn't a z-index hack; it's fitting the card to the stage height so it can never overflow, then
  giving it its own glow and lifting it above the ticker. Now every play reveals on the stage and
  travels toward its home instead of teleporting.
- **One switch turns all motion off.** Every animation — the drag spring, the stage travel, the
  overlay eases, the ticker slide — reads reduced-motion from a single module. So
  `prefers-reduced-motion` collapses the whole game to instant in ONE place, and nothing breaks. That
  same switch is the foundation the later juice milestone reuses.
- **The turn token is a tiny state machine.** One control carries the whole end-of-turn story: three
  circles that fill as plays are spent, a 2.5s draining ring that auto-ends once they're gone (paused
  if you're still rearranging a wildcard, tappable to end now), an arm-then-confirm early end, and the
  gold SAUDA! declare. The mode decision is a pure function so the whole matrix — including the safety
  that a declarable win can never auto-end the turn — is unit-tested without a browser.
- **Crisp big cards without re-drawing them.** A card is drawn at 132px; blowing it up to the 200px
  inspect size with a CSS transform upscales a small bitmap (blurry). The fix is one line: for the
  upscale case, use CSS `zoom` instead — the browser re-lays-out the card at the bigger size, so its
  vector text rasterises at native device pixels (crisp). Shrinking still uses the cheap transform.
  Now no card face is ever transform-scaled above 1.0 — the crispness law, proven live.

## PHONE-1 — real-device recovery + shell (interview crib)

- **A phone is not a desktop frame.** The whole pass is judged on a device testbed: Playwright
  profiles at 360x740 / 360x800 / 384x832 / 412x915 at their real DPRs + a reduced-motion variant,
  from ONE shared `deviceProfiles.json`. A `?hud=1` overlay shows the live viewport, DPR,
  reduced-motion and measured zone heights — how you debug on-device without guessing.
- **The void + the scroll (P1).** The play screen is a fixed 100dvh shell (dynamic viewport units, so
  the phone URL bar can't reveal a scroll) with safe-area padding and page-scroll killed
  (`overscroll-behavior:none`, `touch-action:manipulation`, `overflow:hidden`). The old percentage
  zones became a clamped-flex law (`resolveZones`, pure + tested): fixed table band, px min/max per
  zone, surplus to my area first — so the idle centre stage collapses and the void is gone. Proven:
  doc height == viewport at every profile, no scroll.
- **One layer scale ends the slab bugs (P2).** Every zIndex comes from the `LAYERS` token, low→high;
  an eslint rule bans raw numbers and a test asserts the order. Root causes were concrete: the dark
  slab over the wheel was the inspect scrim staying up mid-drag (now transparent while carrying); the
  ticker-over-card was DOM-order luck (ticker pinned lowest, staged content above).
- **Thumb-sized drops kill the MAKAAN rage (P3).** While dragging, eligible zones inflate into a band
  of ≥64px slots (one per set, banner colour + name) + a ≥72px bank strip; the in-place zones drop
  their `data-drop` so the magnet reads the big rect. Near-miss forgiveness commits a slow release to
  the single eligible zone within 120px (never guesses when two are near). A missed drop always
  explains itself — a pulse + hint, or the card's why-line.
- **Decorative vs comprehension motion (P4).** Transforms may go instant under reduced motion; the
  bot reveal-hold and turn beats are plain timers that never reduce, so a reduced-motion game is still
  followable. Pacing raised to owner-tunable floors (900/600/400/4000ms). Also fixed a latent bug:
  reduced motion never committed a drop — now it does.
- **The front door (P8).** HOME is a real screen (stamp wordmark, KHELO→setup→deal, VS FRIENDS COMING
  SOON, NIYAM). THE BOOK derives every number from engine constants and renders REAL card faces, so
  it can't drift from the rules. An in-game home glyph opens a pause sheet that freezes every timer
  (bot step, auto-draw, auto-resolve, the turn-token drain) — the first way back OUT of a game.

## PHONE-2 — closing the PHONE-1 gaps (interview crib)

- **A "feel" pass is proved with motion, not stills.** The PHONE-1 report flagged that a still can't
  evidence a fling, a parting wheel, or a bot beat. So PHONE-2 reuses the excellence-pass webm recorder
  on the phone device profiles (412x915 + one 360x740): money flinging into the bank, a MAKAAN
  thumb-drop, the wheel's parting-wave scrub, a near-miss pulse, Home→setup→deal-in — and, crucially,
  the SAME bot turn recorded motion-on and reduced-motion, so the comprehension-vs-decoration split is
  visible side by side. Anything that genuinely won't render is reported with its error, never faked
  with a still.
- **Where UI copy lives vs. where behaviour lives.** The PHONE-1 P6 note wrongly assumed the bot freeze
  blocked rewriting Munshi's advice text. It doesn't: the byte-identical lock covers the bot's DECISION
  (which move + a `reason` enum), not the sentence shown. So the copy moved to the mobile layer
  (`munshiAdviceLine`), where every line is now a full sentence that names the move and gives one
  concrete reason — the same rename-in-one-file pattern the codebase already uses for card/set names.
- **Overlap is a layout bug, fixed with layout.** The advisor card was breaking (pips/mini-cards over
  text). The fix isn't nudging z-indexes — it's a plain flex row (medallion · `minWidth:0` wrapping
  sentence · `flexShrink:0` card) so nothing can ever occupy the same space. The medallion loads the
  owner's `munshi.webp` if present, else a code-drawn bust, and floats transform-only unless reduced
  motion is on.
- **Reduced motion must announce itself.** If the OS forces `prefers-reduced-motion`, the player can't
  otherwise tell the feel layer was switched off. Two quiet disclosures now exist: an unmissable red
  HUD banner (dev), and one permanent line in the pause sheet (shipped) — discoverable truth, no nag.
- **An honest lint gate.** The 7 "pre-existing" errors are gone: dead vars/blocks in dev capture
  scripts removed, and a lone `eslint-disable` pointing at an uninstalled `react-hooks` rule replaced
  with a plain note (installing the plugin would have added a dependency and unbounded new lint surface
  under a freeze). `pnpm verify` now runs lint first, so zero can't silently become seven again.

## LANDSCAPE REBUILD (R) — the interview crib

- **Landscape-only via a rotate gate, not a forced orientation.** Browsers can't force orientation
  outside fullscreen, so `orientationOf(w,h)` (`h > w` = portrait; a square is landscape so a
  mid-rotation tie can't flicker) decides, and in portrait the App renders `RotateGate` INSTEAD of the
  game. The game is *unmounted* — its state lives in the zustand store, so no bot steps behind the gate
  and rotating back resumes exactly. Fullscreen + `screen.orientation.lock` is best-effort; the M5
  Capacitor manifest pins landscape natively.
- **Focus follows turn is two pure zone-maths functions, one Board that keeps all the glue.**
  `landscapeLayout.ts` (`resolveMyTurn` / `resolveSpectate`) is DOM-free and unit-tested, so the layout
  is provable without a browser. Board keeps every drag/tap/targeting/inspect handler and just delegates
  the *composition* to `MyTurnLayout` (my world only) or `SpectateLayout` (the split) — a `FocusTransition`
  wrapper keyed on whose turn it is plays one 250ms slide/fade between them (instant under reduced motion).
- **The wheel got wider, and it's proven.** The wheel spans the full content width (≈694–869px vs the old
  ~344px my-area), so a clearer arc. The no-clip invariant suite now runs at those landscape widths too —
  containment holds by construction (the radius is derived so the extreme card fits), so more width just
  means a wider, cleaner spread.
- **The hidden-text bug is fixed by moving the label off the card.** `shortLabel(card, play)` builds a
  one-line "B2 · Chennai Central" caption pinned ABOVE the spotlit card on `LAYERS.badge`, so it can never
  sit behind it again. It's unit-tested across every card family + the length cap; `stagePlayFromEvents`
  derives the play kind from the acting bot's last event.
- **Two audits that touched no engine code.** R3: opponent bank is already public (`OpponentView.bank`),
  so the zoom just renders it. R4: the payment roster already included banked actions — the bug was that
  `isMoney` mis-bucketed a banked action as a "property" and hid it; `fromBank` (money OR banked action)
  fixes it, so a banked AAGE BADHO sits with the money and strategic overpay is one tap.
- **Munshi advice is composed in the UI layer from public facts.** `composeMunshiAdvice(advice, obs)`
  keeps the frozen bot's decision but writes the sentence from set progress / a visible rival threat / the
  threat / a card value / plays-left — every line names the move and cites ≥1 concrete PUBLIC fact, never
  hidden info. `packages/bots` stays byte-identical.
- **The ip-guard caught a real slip.** A stray two-word phrase in a code comment (an incidental match
  of a banned third-party property name) tripped the repo-wide IP guard — a reminder that §2 is enforced
  mechanically, not by vigilance. Run the FULL suite before a commit, not just the app tests, or the
  engine's guards can be missed.

## LANDSCAPE-2 — verify, prove, clean (interview crib)

- **The green gate is now a WALL, not a convention.** `pnpm gate` runs the ip-guard FIRST and fast
  (~1s), then typecheck, lint, and the full 418-test suite; a versioned `.githooks/pre-commit`
  (activated by `core.hooksPath`, so it travels with the branch) runs it and blocks any red commit.
  It proved itself immediately — it blocked two of my own commits (a comment that re-quoted the banned
  phrase; an unused variable) until they were green. The R pass's four "app-green but engine-red"
  commits are recorded in DECISIONS as retroactively confirmed green at HEAD and left unrewritten,
  because rebasing a branch the owner has already pulled onto a phone is riskier than the slip was.
- **The table band is a gauge, not a target.** Auto-draw made the piles display-only, so the restored
  draw-count + discard-top readout is `pointer-events: none`, absolutely positioned (zero layout
  footprint → no scroll), on the low `LAYERS.board` tier, pinned in a corner each layout leaves free.
  You read it; you never act on it.
- **Motion is finally proven with motion.** Eight webm clips (Playwright `recordVideo` + the committed
  `__replay` / `__saudaCapturePaused` hooks, unfrozen so real animation plays) cover the my-turn↔spectate
  flip both ways, a captioned bot turn, the targeting split, the overpay, a wheel scrub, and a money
  fling. Each embeds an assertion, so "rendered" means the moment actually happened.
- **Two states the fixtures don't hand you, reached deterministically.** HAATH KI SAFAI is in no
  fixture's play-turn hand and turn 1 has no stealable targets, so the clip deals a known seed, passes
  turn 1 (bots place properties), and draws into turn 2 — now the card is held and every opponent has a
  single, stealable property. The overpay needs me to owe exactly ₹2 with a banked ₹3 action card: I
  bank the action card, a bot plays SHAGUN (every opponent owes ₹2), and because SHAGUN stacks a charge
  per opponent resolved last-in-first-out, the script resolves the two bot charges synchronously so the
  payment sheet lands on ME — then selects the banked action card for the "no change given" overpay.
- **The unseen profiles were eyeballed, not just harness-checked.** 800×360, 832×384 and the
  reduced-motion variant each got MY-TURN / SPECTATE / targeting stills, audited by eye — all clean. The
  targeting overlay's full-screen scrim is why the many-target chips read correctly over the dimmed hand
  fan (chips on `LAYERS.surface`, wheel below it).
- **The orientation shell is asserted end to end.** Portrait → rotate interstitial (game unmounted);
  landscape → game; "Go fullscreen" → `requestFullscreen` then `orientation.lock('landscape')`, each
  try/catch-wrapped. Instrumented spies in the L6 capture prove the lock is called and its rejection is
  swallowed, so it degrades to a by-hand rotate on browsers that refuse it.
- **A Cloudflare quick tunnel is ephemeral.** The owner's tunnel had ~1300 edge-registration failures
  and served an error page; a dead tunnel is useless, so it was restarted and the new URL confirmed live
  in a real browser (Home 200 + the /#/autostart game render). Quick-tunnel URLs rotate on restart, so
  the live one lives in the pass report, never hard-coded.

## LANDSCAPE-3 — Munshi portrait + final polish

- **The Munshi portrait rides the SAME plate pipeline as the other 45, not a bespoke asset path.** The
  owner's square lithograph is scaled to the 600 width and centred on a white 600×870 card canvas (its
  own outer margin is white, so the pad is invisible), then webp q82 — so `plates.test.ts` (100:145,
  ≤150 KB) passes with zero special-casing and the glob picks it up. `munshi` is never a full card face,
  so the pad never shows in-game; only the round advice-card medallion references it.
- **The circular framing is a CSS mask, never an image edit.** The 46 px medallion frames the face with
  `object-position: 50% 20%` (biasing up off the litho's hands-and-ledger centre) and `transform:
  scale(1.32)` (pushing the litho's own cameo ring past the slot edge). The lithograph file stays exactly
  as the owner drew it; the mask lives on the `<img>`, independent of the slot's reduced-motion float.
- **The targeting graze is fixed by parking the hand, not by fragile band geometry.** On 740×360 the
  hand band is ~166 px of 360, leaving too little to reserve a clear band above it for the 88 px card +
  wrapped chips. Since the hand is a sleeping, already-non-interactive modal background while targeting,
  `handAsleep` drops the wheel band to opacity 0 + pointer-events none (height kept, so no reflow) — the
  chips can't graze a hand that isn't drawn. Targetability stays purely `legalActions`.
- **`pnpm phone` is one command that always prints the current URL.** Quick-tunnel URLs rotate every
  restart and kept stranding the owner on a dead URL. The helper ensures the dev server is up, opens a
  fresh `cloudflared` quick tunnel, waits for the public URL, and prints it with the `/#/autostart`
  deep-link and a terminal QR. A stable non-rotating URL needs a Cloudflare **named** tunnel (account +
  token) — documented as the upgrade path in `docs/PHONE_PLAYTEST.md`, out of scope here.
- **L2's motion clips already covered M3.** The eight webm clips (both MY-TURN↔SPECTATE transitions,
  captioned bot turn, HAATH KI SAFAI + My-Sets reference, Rs3-banked overpay, wheel scrub) landed in
  `docs/captures/landscape-2/` and are real non-empty webm — so LANDSCAPE-3 re-verified them rather than
  re-rendering.

## AUDIT-Z — the demanding-user quality pass (interview crib)

- **A quality audit is a driven proof, not a read-through.** AUDIT-Z drove the *real* build through
  both landscape profiles across **5 full solo games on 5 seeds** and asserted zero page-scroll,
  console-error, soft-lock, unhandled-phase or stuck-bot events — property placement by drag (including
  the first property of a new colour) and overlay dismissal driven live. The output is a ledger +
  `docs/captures/audit-z/audit-z-results.json`, so "no defects found" is evidenced, not asserted.
- **The one code change was a deletion.** The audit found dead code — an orphaned `DropBand` and a
  `suppressDrop` plumbing path with no live caller — and removed it (Z1). Everything else it touched was
  documentation of confirmed-good behaviour. The launch-blocker ranking was confirmed unchanged: the
  blockers are the *deferred-by-decision* items (native package, onboarding, sound), not bugs.

## S — HAND + INFO REDESIGN, and difficulty that MEANS something (interview crib)

> This pass supersedes some of the M4b/PHONE wheel notes above: **the half-roulette wheel is retired.**
> The hand is now a flat row of UPRIGHT cards (the SPREAD). The wheel history is left in place because it
> happened and the containment proof was real, but the shipping hand is the spread described here.

- **The owner lost every game — because all three difficulties were the same bot.** Root cause: the
  frozen HeuristicBot only varied a NAHI threshold, so medium ≡ hard exactly, and every tier ran the
  same ~95.8%-win brain. The fix is a new **`packages/difficulty`** wrapper that WRAPS the frozen
  `recommend()` and DEGRADES it by tier: hard = the bot verbatim (consumes no rng, so byte-identical);
  medium/easy discard the recommendation with a tuned probability and play a weaker *legal* move instead
  (easy prefers a quiet bank/build/pass over a wasted attack — a timid beginner, not a wrecking ball).
  The only randomness is the seeded game rng, so a game stays fully reproducible. **Munshi is exempt** —
  the advisor always calls full-strength `recommend()`, so the human's advice is sharpest regardless of
  the table's tier (enforced in the store, asserted in tests).
- **The tiers were tuned against the simulator, and the win-rate tables are committed.** `pnpm winrates`
  measures seat-0 win share over ≥1000 seeded games per config. Against a strong player at the 3-bot
  table the tuned bands land **easy ~74% · medium ~46% · hard ~23%** (hard IS the real bot ≈ the 25%
  fair share; it can't go lower without weakening the frozen brain). The slip probabilities live in one
  exported table (`SLIP_PROBABILITY`), tuned there if the bands ever drift.
- **The other five S directives were all presentation over `legalActions`.** The SPREAD (S1) is a flat
  upright row whose no-clip invariants replace the wheel's; the rest card grew ~69→~98px at the 915
  profile, lifting the value badge past the legibility floor with the toggle OFF. Opponent bank cash is
  now private — only the note *count* is public, for bluff tension (S2). All five targeted actions pick
  **real cards**, not text pills, with a difficulty-gated best-target hint (S3). A quiet "◈ arrange"
  nudge assists the wildcard-combination case (preview → Confirm fires free REARRANGE moves; never
  auto-plays) (S4). The bigger cards were swept for collisions at both profiles (S5).
- **T — proving the claims that were only argued.** The difficulty tier is proven to reach *live* play:
  three games at one seed diverge by tier in a real browser (`?difficulty=` + `?bots=` deep-link params,
  live tier shown in the HUD). No p95 regression from the bigger card (spread scrub+drag p95 ~16.7ms at
  both profiles) and legibility *rose* (badge 7.3→10.4 device-px). Evidence:
  `docs/captures/hand-info-1/`. `packages/engine` + `packages/bots` stayed byte-identical throughout —
  the difficulty wrapper and the assistant only *sequence* moves the engine already offered.

## DEPLOY-1 — a permanent web link (interview crib)

- **The #1 launch blocker was "no stable link", and it's an engineering problem, not a devops afterthought.**
  Every playtest needed the owner's laptop alive running a *rotating* Cloudflare quick tunnel, which kept
  stranding testers on dead URLs. DEPLOY-1 makes the solo, fully-client-side build shippable to a static
  host (Vercel): `vercel.json` (build/output/install + SPA rewrites) is committed and the build verified
  from the repo root.
- **Dev surfaces are dead-code-eliminated from the prod bundle.** The `#/dev/*` routes, the spread lab,
  `?hud`, and the `window.__replay/__sauda/__craft` capture bridge are now gated behind
  `import.meta.env.DEV`; a grep of the built output for those identifiers is empty and the globals read
  `undefined` in the served build. The prod build is clean (259 modules, main JS 320.87 kB / gzip
  96.69 kB). The only code change was DEV-gating those routes in `App.tsx` — `packages/engine` +
  `packages/bots` stayed byte-identical.
- **The last mile is owner-only, and that boundary is deliberate.** `vercel login` is interactive
  (it must not be automated) and creating the GitHub repo + first push is the owner's to do; both
  steps are written out precisely in `docs/DEPLOY.md`. Once run, the app has a permanent `*.vercel.app`
  URL and the rotating-tunnel dependency is retired for good. Tests held at the **462** floor.

## First-player pass (U) — the sister's playtest (interview crib)

- **The iPhone 12 clip was a viewport-units bug, not a layout bug.** iOS Safari reports `100dvh`/`100vw`
  unreliably (URL bar / tab strip occupy height dvh doesn't subtract) and in landscape the notch inset
  sits on the SIDE. Fix: `game/viewport.ts` reads the LIVE `visualViewport` + safe-area insets on every
  resize/scroll/orientation event, and the shell is sized to that measured box — so the board fits the
  rectangle that actually exists.
- **Below a minimum playable box, scale the whole board — never clip.** `fitToBox` is a pure function:
  at/above the min box (600×300) it lays out 1:1; below it, it returns a uniform `scale<1` so everything
  shrinks together. A dense invariant test proves no element ever lands outside the measured box; at
  scale 1 (every real device) the change is a no-op, so existing behaviour is untouched.
- **Portrait adapts instead of blocking (U2).** The old rotate gate was a wall a browser can't honour;
  now portrait fits a compressed, bottom-aligned landscape board with a slim dismissible banner.
- **Difficulty is CHARACTER, not randomness (U4).** The wrapper only filters/reorders the frozen brain's
  already-legal moves by six tier-scaled traits; when it suppresses (say) an attack it falls back to the
  best remaining build/bank — never a random move. That's why a weak bot reads as a gentle beginner, not
  a broken one (proven by the `tiers` fingerprint: easy still banks + places normally, just rarely
  attacks/rearranges and dawdles on the win). Hard = all traits 1, zero slip → draws no rng → byte-for-
  byte the frozen bot.
- **A random-floor beginner can't beat a plausible bot 4-in-5 — so the human gets a fair deal on easy.**
  The opening-hand assist (one named constant) swaps a few of the human's non-building cards for building
  material at the deal, on easy only; it keeps the 106-card deck complete and rigs nothing mid-game.
- **The tutorial is a real, deterministic, engine-legal game (U3).** `game/tutorial.ts` crafts a fixed
  game + a stacked draw pile so each draw is known, and every scripted step goes through `reduce`; the
  test replays the whole thing, proving each move legal and the finale a real declared SAUDA. The cursor
  and beats are pure UI on top — the correctness lives in the replayable script.

## W — onboarding + orientation rebuild (first-player pass)

- **Landscape-only is a single app-root guard, not a per-screen check (W1).** `App` reads the live
  orientation and, in portrait, returns `<RotateScreen/>` instead of the whole tree. Because the game
  state lives in the external zustand store (not in any component), swapping the tree out and back loses
  nothing — a rotate mid-game returns to the exact same state. That is why the fix is one `if` at the top
  rather than portrait branches scattered through Board/Home/Table (all of which were deleted).
- **The rotate screen is an invitation, not a wall (W1).** It is drawn in the SAUDA language (a code-drawn
  phone SVG that tilts on a CSS keyframe, held still under `prefers-reduced-motion` by a media guard) and
  offers the one thing a browser can do: `requestLandscapeFullscreen` best-effort enters fullscreen then
  `screen.orientation.lock('landscape')`, swallowing failure — fullscreen is the only place a browser may
  lock orientation. The real lock ships in the M5 native manifest.
- **Onboarding is a pure trigger engine over `legalActions` (W2).** `onboarding.ts` answers "which mechanic
  just became available?" from the human's `legalActions` + `Observation` alone — one small predicate per
  mechanic, returned in a priority order. It reads only the engine's offer, so a coach mark can only ever
  point at a move that is already legal; it decides no rule and plays no move. This is the whole reason the
  onboarding can never break the game — it has no path to change what is legal.
- **The coach controller is driven by state identity, not timers (W2).** `useCoachMark` shows one coach at
  a time; "did the player act?" is just `state !== theStateWhenWeShowedIt` (the store hands back a fresh
  state object per applied action). A coach clears the moment the player acts or taps it off; teach-once is
  persisted; two dismissals in a turn go quiet. Nothing is scheduled — a coach appears because a move
  became legal and clears because a move happened.
- **The gesture ghost reuses the U3 cursor; the U3 demo player is gone (W2).** The gold `TutorialCursor`
  survives as the coach mark's gesture ghost (a single travelled pass, or a static arrow + word under
  reduced motion); the scripted `TutorialPlayer` that played a game FOR the player was removed. The old
  tutorial script lives on only as a test fixture — `onboardingLive.test` runs it as a real legal game to
  prove 6+ coach marks fire at exactly the moment each mechanic first becomes available.
