# DECISIONS

One line per rules interpretation, deviation, or engineering choice worth remembering.

## M0 — Scaffold

- `DEFAULT_RULES` (§7) lives in `packages/engine/src/rules.ts` (config), kept separate from `theme.ts` (display strings). [approved]
- M0 commit uses the `chore:` prefix (tooling-heavy scaffold) rather than `feat(engine):`. [approved]
- Structural identity (`SET_IDS`, `ACTION_KINDS`) lives in `types.ts`, not `theme.ts`; `theme.ts` supplies display values keyed by those structural keys. This makes card IDs theme-independent by construction.
- Card IDs use the shape `<category>_<structuralKey>_<index>` (e.g. `prop_mumbai_0`, `action_kabza_1`) and are derived only from structural keys — never from display names — so a `theme.ts` edit cannot corrupt a persisted save (saves land in M4).
- The id-independence test forbids any human-facing display string from appearing inside a card ID, *except* strings that (ignoring case/whitespace) are identical to a structural key (e.g. set label "Mumbai" == key `mumbai`, action name "Kabza" == kind `kabza`). The structural key is the sanctioned ID source; every other display string is forbidden.
- The IP guard scans the **whole repo** (so `apps/`, `tools/`, `store/` listing copy are covered automatically as they are added), with an allowlist of exactly two files that legitimately quote the banned terms: `CONTRIBUTING.md` and `docs/BUILD_SPEC.md`. Banned terms are assembled from string fragments so the guard file itself contains no banned literal.
- Toolchain pinned for reproducibility: `packageManager: pnpm@11.17.0`, `engines.node >=24.15.0 <25`, `.nvmrc = 24.15.0`.
- TypeScript strictness hardened beyond `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `isolatedModules`.
- The green-before-advancing script is named `pnpm run verify` (not `ci`): `pnpm ci` collides with pnpm's built-in clean-install command and would silently reinstall instead of running the gate.

## M1 — Engine

### Interrupt stack / NAHI CHALEGA
- The interrupt stack uses **one frame per charge**; NAHI CHALEGA cards accumulate in a `nahiChain` inside that frame and the `responder` flips each time. The charge **stands iff `nahiChain.length` is even**, and is cancelled iff odd. This *parity* model is a deliberate simplification of the spec's literal last-in-first-out NAHI stack (§5): unwinding a LIFO stack of cancels-of-cancels is exactly a parity toggle, so counting is equivalent and far easier to explain. A test (`interrupts.test.ts`) proves parity ≡ manual LIFO resolution for chain depths 0–4.
- Multi-target charges (SHAGUN, duo KIRAYA) push **one independent frame per opponent** (§5: "each target resolves independently — one player's NAHI CHALEGA only protects that player").

### Paying with buildings (spec gap — decided explicitly)
- **MAKAAN/HAVELI on a set CAN be handed over as payment.** They sit on the table with a face value (MAKAAN ₹3, HAVELI ₹4), and §4.5 says you pay with cards on the table, so they are payable. Paying with a building **does not break the set** — buildings are not counted toward set completion — so the set stays *complete but stripped* of its rent bonus. This is distinct from paying with a *property*, which can break the set and orphan its buildings (§4.5 last bullet). Both paths are tested in `payment.test.ts`.

### Payment API asymmetry (deliberate exception to "legalActions is the single source of truth")
- For payment, `legalActions` returns a **single `RESPOND_PAY` template** (amount owed + the list of payable card IDs), **not** the enumerated set of valid subsets — subset enumeration is exponential in table size. This is the one place a caller can submit an action that was never in a `legalActions` list, so two things follow:
  1. `reduce` **validates `RESPOND_PAY` exhaustively and defensively**, with a distinct `RuleViolation` code per failure mode (ANY-wildcard included, card not on debtor's table, underpay when able, partial-pay must be pay-all when table < owed).
  2. A shared, tested helper **`suggestPayment(state, request, strategy)`** is the one canonical way to *pick* a selection. Bots consume it in M2; the M3 UI offers it as "auto-pay". Callers never re-implement §4.5.

### Overpay policy — legality permissive, strategy minimal
- `validatePayment` is **permissive**: any selection worth ≥ the debt is legal (pay-all when the table is short). The rules don't require minimality, and checking it is a subset-sum problem that is expensive and hard to explain, so the engine does not invent that constraint.
- **`suggestPayment` always minimises overpay** — voluntary overpay is legal but never what a bot should choose. A test asserts bots never overpay when an exact or cheaper combination exists. (M3 UI will show a live "overpaying by ₹N" warning so voluntary overpay is always deliberate.)

### Implementation choices
- **One immutable card registry + IDs-in-zones.** `GameState.cards` holds all 106 cards once; every zone stores only card IDs. Card conservation is then a cheap set comparison (`invariants.checkInvariants`).
- **`reduce` clones-then-mutates.** Each call deep-clones the mutable state, mutates the clone, and returns it (the card registry is shared, not copied). Chosen for readability over threading immutable updates through every zone; it also can't alias the caller's state.
- **Source action cards are discarded the instant they are played.** You spent the card whether or not it is later cancelled, and it never returns to a hand. So an interrupt frame tracks only the NAHI cards (`nahiChain`) and wildcards awaiting placement (`pendingReceive`) — which also stops a single SHAGUN card being double-counted across its per-opponent frames.
- **`reduce` takes no actor id.** The actor is implied by state: turn actions are the current player's; responses are the open interrupt's `responder` (that is exactly how off-turn NAHI CHALEGA works).
- **KIRAYA is bankable** (treated as an action-type card for §4.4 "bank any money or action card").
- **Rearranging a wildcard out of a complete set relocates its buildings** (§4.5's orphan rule applied generally, not only during payment).
- **Multi-target charges push one frame per opponent** and resolve top-of-stack first; sibling order is deterministic (reverse of push order).

## M2 — Bots + CLI

- **Bot interface:** `chooseAction(observation, legalActions, rng) → Action`. Bots see only an `Observation` (hidden info respected) and the exact legal move list; they never touch raw state.
- **`observe` now exposes the open interrupt** (origin/target/status/effect) — a charge is public, and a bot needs it to size a NAHI CHALEGA / payment decision.
- **HeuristicBot delegates ALL payment to the engine's `suggestPayment`** (surfaced as the single `RESPOND_PAY` that `legalActions` provides). It never re-implements §4.5 (user directive). A test asserts the bot's selection is byte-identical to `suggestPayment`.
- **`suggestPayment` upgraded to damage-aware** (M2): minimal overpay stays the primary key, with a secondary tie-break that prefers giving cash over property and never breaks a complete set unless forced. Shared by bots now and the M3 "auto-pay" UI. The payment-minimality tests are unaffected (they pin the sum, not the tie-break).
- **The simulator asserts ZERO invariant violations across all 1000 games**, not merely that games finish (user directive). It also enforces the §8.3 targets and exits non-zero on any miss.
- **§8.3 gate result:** HeuristicBot(Medium) vs RandomBot over 1000 seeded games → **95.0% win** (target ≥90%), **avg 20.6 turns** (target ≤25), **0 invariant violations**.
- **Workspace glob fix:** `tools` is a single package, so the workspace entry is `tools`, not `tools/*` (which matches only subdirectories).
- **CLI runs via `tsx`** (no build step): `pnpm play` (interactive human vs 3 bots; `--auto` plays all seats for a demo transcript), `pnpm simulate --games N`.
- **HeuristicBot difficulty (v1)** currently tunes the NAHI CHALEGA threshold; the core strategy is shared across Easy/Medium/Hard. Deeper per-difficulty play (discard/played-card tracking for Hard) is deferred.

## M3 — Mobile core (web)

- **`apps/mobile` is a Vite + React 18 + TS web app.** M3 is deliberately visually neutral (plain, legible) — the desi pop-art identity, fonts, stamp-slam signature, motion and sound are **M4**, to be designed deliberately (per user), not auto-generated. Capacitor/Android packaging is **M5**.
- **No game rule lives in React.** The zustand store is a thin shell over `@sauda/engine`: `dispatch === reduce`, `stepBot` asks a `HeuristicBot` to pick from `legalActions`, the board renders `observe(state, viewSeat)`. `labels.ts` is presentation-only (reads the theme). If a component needs to know legality or outcome, it asks the engine.
- **Every interaction is `legalActions`.** The action panel renders one button per legal move (grouped by the hand card it uses); interrupt responses (NAHI CHALEGA / allow / pay / place-received) are surfaced as buttons; the board can only offer legal moves — the same guarantee the engine gives the CLI.
- **Payment in the UI** offers the single suggested `RESPOND_PAY` that `legalActions` provides (from the engine's `suggestPayment`). A manual card-by-card payment picker is deferred to M4 polish.
- **Hand-off overlay** shows only when the actor is a human *different* from the currently revealed human (pass-and-play privacy); solo (single human) never shows it. The board renders the revealed seat's perspective underneath.
- **Bots auto-advance** via a timed effect (300 ms) stepping one move at a time so the board updates between moves; the bot RNG is seeded per game.
- **M3 gate proven headlessly:** a store integration test drives full solo *and* pass-and-play games to a winner through the real store/engine/components (jsdom) asserting **zero `console.error`**; the App mounts and starts a game; `vite build` succeeds. (Real-browser automation was flaky in this environment; `pnpm --filter @sauda/mobile dev` serves it for manual play.)

## Rules clarifications (from the official property rules)

### Win condition — 3 complete sets of 3 DIFFERENT colours (§4.1)
- Confirmed and made explicit: `hasThreeCompleteSets` now returns `distinctCompleteColorCount(...) >= 3`. Before the overflow change this held only *by construction* (one group per colour); with multiple groups per colour it must be an explicit distinct-colour count. Test (`overflow.test.ts`): two complete jaipur sets + one complete mumbai set = 3 complete sets but only 2 colours → **not** a win.
- The official "same-colour sets allowed" variant is a **deliberate deviation** — SAUDA requires different colours. It could live behind a rules flag (e.g. `winRequiresDistinctColors`) later.

### Set overflow — a colour can hold more than one set (implemented)
- **Data model:** `PlayerState.properties: Record<SetId, PropertyGroup[]>` — each colour holds a list of independent sets. `groups.ts#addToColor` fills the first non-full group and otherwise starts a new one, so a group can never exceed its size; surplus (only reachable via wildcards) forms a **second** set. Emptied groups are pruned (`removeFromProperties`/`pruneEmpty`).
- **Completion & win:** `completeSetCount` = total complete *groups* (two same-colour complete sets count as 2 sets); `distinctCompleteColorCount` = colours with ≥1 complete set; the win uses distinct colours.
- **Rent per group:** `kirayaForGroup` computes one group's rent; `kirayaFor(colour)` charges the **best (highest-rent) group** of that colour — each group is its own set, rents are never summed across a colour. Test asserts two complete jaipur sets charge ₹4 (one set), not ₹8.
- **Buildings & KABZA:** MAKAAN/HAVELI attach to a specific complete group; KABZA steals one complete group of a colour (moved to the thief as its own set, which can give them two sets of that colour).
- **Bots:** the HeuristicBot skips building toward / stealing for an already-complete colour, since a second same-colour set cannot advance the distinct-colour win. Simulator after the change: 95.8% win, 20.3 avg turns, 0 invariant violations.
