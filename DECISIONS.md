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

## Copy & language policy

- **Card names stay desi proper nouns** (Kabza, Haath Ki Safai, Adla-Badli, Nahi Chalega!, Vasooli, Shagun, Aage Badho, Makaan, Haveli, Dugna!, Kiraya) — they are the game's identity and are never translated. **Every other player-facing string is clean English** (tagline, instructions, buttons, tooltips, empty states, win/hand-off copy). No Hinglish anywhere except those names.
- **Tagline changed** from "Deal karo. Kabza karo. Jeeto." to **"Collect. Conquer. Win."** (`theme.ts#GAME.tagline`, single source; the app Home and CLI banner now read it instead of hardcoding).
- **Each action card carries a short English `descriptor`** (renamed from the old Hinglish `flavor` field) shown next to its name, e.g. Kabza — "Steal a complete set". KIRAYA has `KIRAYA_DESCRIPTOR`. The app shows the descriptor beside the name in hand.
- Strings converted: the tagline (theme + Home + CLI) and all ten action `descriptor`s (from Hinglish flavour to English). Card names and the title "SAUDA"/"सौदा" logotype are unchanged.

## Totals audit — all on-screen numbers are engine-derived

- The app no longer computes any card value itself. `observe()` now includes engine-computed **`myBankTotal`**, each opponent's **`bankTotal`**, and per-group **`myKiraya`**; the UI renders those numbers directly. The app's old parallel value helpers (`labels.cardValue`/`bankTotal`) were removed.
- Set completion and owned/needed counts use engine `isSetComplete` + `SETS[set].size` over the observation's group list, so overflow (a second same-colour set) is shown as its own chip with its own rent.
- `totals.test.ts` verifies against the engine: bank totals = sum of bankable values; the ANY wildcard is ₹0 and excluded from totals (but still counted as an owned property); a group's displayed kiraya equals `kirayaForGroup` including the MAKAAN/HAVELI bonus; per-group rent across overflow is `[4, 1]` not summed. No numeric mismatch was found — the only issue was that the app *duplicated* the value rule, now removed.

## M4a — Live layer + Deed Card

- **Permitted engine edit only (§2.2):** `SETS` ink hexes updated (data-only) and presentation-only `works` + `est` fields added for the vintage factory footer. Full engine suite stays green; the moved `docs/M4_DESIGN_SPEC.md` contained one banned third-party brand name (in a "&lt;name&gt;-grade" phrase) which I reworded to "board-game-grade" (the doc is scanned by the IP guard and, per its own §0, is not allowlisted).
- **Fonts self-hosted, no runtime fetch:** `apps/mobile/scripts/fetch-fonts.mjs` (dev-only, not shipped/imported) fetches text-subset woff2 once — Baloo 2 (latin+devanagari), Karla + IBM Plex Mono (latin) — bundled under `src/assets/fonts`, **55.9 KB total** (<120 KB). Loaded via local `@font-face` `font-display: swap`. Confirmed no `fetch`/CDN refs in `apps/mobile/src`; ip-guard green.
- **Two-layer CardFace (§3):** a Plate layer (raster `assets/plates/{id}.webp` via `import.meta.glob` if present, else a text-free SVG fallback) + a live layer drawn from theme/engine data (value badge, name, matchstick rent ladder, FULL SET row, factory footer, SAUDA PRESS seal, corner chip). All kinds × FULL/MID/CHIP, one zone contract. No rules in the component.
- **`/dev/plates` route** (`#/dev/plates`) renders every distinct face × 3 sizes, tagging plate vs fallback; drops-in flip to "plate" with zero code change. Tokens live in `design/tokens.ts`.
- **Gate:** awaiting the owner's `/dev/plates` screenshot approval (review + M4b next).
- **Deed live-layer placement (regression guards):**
  - The **corner value chip anchors to the card's bottom-left corner, centred on the footer band's TOP edge** (x≈12%), mirroring the **सौ seal at bottom-right**. It may overlap the footer band *colour* but must never cover the footer *text* (footer text is centred) or any ledger text — "FULL SET" must stay fully readable.
  - **Every rent-ladder row shows its stacked count icon, including the FULL SET row**, which shows the set size (e.g. Mumbai: row 1 = 1-card → ₹3 Cr, row 2 = 2 stacked + "FULL SET" → ₹8 Cr). Counts and values come from engine data (`SETS[colour].size`/`rent`), never hardcoded — a 3-card colour auto-renders rows 1, 2, 3-FULL SET.
  - **The "deeds held of this colour" caption renders only on 2-card sets.** On 3–4-card sets it is omitted (the stacked count icons already convey it), so the extra rent rows always clear the art frame above and the footer below — no per-city art-frame tuning needed across the 37 plates.
- **First art plates landed:** `prop_mumbai_0` (600×870, 27.8 KB) and `prop_kashi_0` (600×870, 47.8 KB), converted from source PNGs to WebP via `sharp-cli`. Kashi (a 3-card colour) confirmed the ledger renders three rent rows correctly over real art.
- **Plate ratio safety net (§4.4):** `apps/mobile/src/design/plates.test.ts` scans `assets/plates/*.webp` and asserts each is a WebP at the 100:145 ratio and ≤150 KB. Dimensions are parsed from the WebP header directly (handles VP8/VP8L/VP8X) — no runtime dependency; only `@types/node` added (dev) for the test. The folder may be empty between art batches (passes vacuously). First plate (`prop_mumbai_0`, 600×870, 35 KB) validated; it is deliberately **left uncommitted** pending a revised Marine Drive that raises the figure out of the 52–84% ledger zone.
- **Action plates key by kind (§3):** `plateKey(card)` returns `action_<kind>` for action cards (so all copies share one painting) and the card id otherwise; `PlateSheet` tags plate/fallback via `plateKey`.
- **Adaptive title ink (§3 legibility):** the property title's ink is chosen per plate by WCAG contrast against the banner colour (`design/titleInk.ts`) — cream name + gold sublabel + a thin dark keyline on dark banners (brown/teal/magenta/navy), dark letterpress ink on bright/gold banners (Kolkata orange, Bangalore amber). Banner colour is normally the set colour; `BANNER_HEX_OVERRIDES` lists plates painted off-convention (currently `prop_mumbai_0` = light gold banner, not the set's navy → keeps dark ink). Chosen over a cream title *plaque* (owner's call) so the title stays printed on the band like a real vintage label. Unit-tested (`titleInk.test.ts`).
- **No ledger wash (owner's call):** the lower half must stay clear cream per §3.4 — a plate whose hero art intrudes into the rent-ladder zone is non-compliant and gets **regenerated**, not masked with a scrim (a wash would hide the defect and defeat plate QC). **⟶ REVERSED — see "Presentation batch (owner-approved)" below.** The law existed to keep batch art QC honest; QC is now complete, so robustness (rows always legible over any art) wins over zero-scrim purity.
- **Duplicate-key defects:** the earlier esbuild "Duplicate key" warnings (`height`, `letterSpacing`) had already been removed in later CardFace edits; a fresh `vite build` is clean, so no change was fabricated.
- **Per-set colour palette LOCKED — v1 (owner; superseded by v2 below):** every set has a distinct banner colour — Mumbai deep prussian navy · Purani Dilli burnt-sienna brown · Kashi prussian teal · Jaipur magenta pink · Kolkata vermillion orange · **Chennai chrome yellow** (`#EDB20C`, changed from red `#C6342B`) · **Bangalore azure sky blue** (`#4E9FCE`, changed from amber `#E3A81C`) · New Delhi leaf green · Junctions press-ink black · Utilities sage green. Only `SETS[set].hex` changed in `theme.ts` — presentation-only, engine maths and the deck-composition test are unaffected. `titleInk` recomputes automatically: Chennai's light chrome-yellow banner now takes **dark** ink (was cream on red) — an owner-approved spec change, reflected in `titleInk.test.ts` (not a weakened test).
- **Per-set colour palette v2 (owner, FINAL v2) — two more changes:** **Kashi** prussian teal `#1F7A8C` → **deep kesari saffron `#E1780A`**, and **Kolkata** vermillion orange `#D96C2C` → **royal violet `#5B3E96`** (blue-leaning, kept clearly distinct from Jaipur magenta `#C2367E`; Kolkata moves because Kashi takes the orange/saffron family). Final 10: mumbai navy · puraniDilli brown · kashi saffron · jaipur magenta · kolkata violet · chennai chrome yellow · bangalore azure · newDelhi leaf green · junction black · utility sage. Presentation-only `theme.ts` hex change; engine maths + deck-composition test unaffected. `titleInk` recompute: saffron → **dark** ink, violet → **cream** ink (test expectations updated; owner-approved, not weakened). Straggler overrides extended: `prop_kashi_1/2` pin the painted teal and `prop_kolkata_0/1/2` pin the painted vermillion until their recolour regens land. `docs/M4_DESIGN_SPEC.md` palette line synced to v2.
- **Stale-plate banner overrides (audit finding):** a full banner audit of all on-disk plates found mismatches beyond the expected ones. `BANNER_HEX_OVERRIDES` (in `titleInk.ts`) now pins the *actual painted* banner so titles stay legible until regens land, in two groups: (a) **early gold-band plates** `prop_mumbai_0`, `prop_kashi_0`, `prop_jaipur_0`, `prop_jaipur_1` — painted with a gold title band before the banner=set-colour convention (owner deciding whether to regenerate for full palette consistency); (b) **palette-lock stragglers** `prop_chennai_0/1/2` (red), `prop_bangalore_0/1/2` (amber), `prop_newDelhi_0/1` (yellow) — each to be removed from the map when its regenerated plate lands. `prop_newDelhi_2` has an olive/lighter-than-locked green banner (borderline) and is left on the set-colour path.

## M4b — Interaction spec

- **M4b/M4c interaction spec LOCKED (owner-approved):** `docs/M4B_INTERACTION_SPEC.md` (v1.0) added verbatim as the interaction-side twin of `M4_DESIGN_SPEC.md` — reference only, NOT implemented yet (M4a art still in progress).
- **M4b spec set LOCKED at v1.2 (owner-approved) — reference-only until M4b starts:** added verbatim `docs/M4B_STATE_MATRIX.md` (every player-facing situation × UI treatment + visual-constancy laws + the six-question VERIFY ledger) and `docs/M4B_SPEC_v1.2.md` (amendment layer superseding v1.0 §5 — tap→centre-stage→rail model, locked screens, wildcards (dual + ANY), Learn screen: Niyam + Munshi ki Salah). One correction: STATE_MATRIX §2 column-key now reads "spec v1.2 direction" (was v1.1). `M4B_INTERACTION_SPEC.md` (v1.0) already committed and left as-is — verified it ALREADY matches canon: it carries the Munshi chip paragraph and the face-down-under-draw-pile overflow wording that agrees with the engine house rule. (An earlier flag that the committed copy was stale was wrong — a diff was read backwards; the on-disk Downloads export is the OLDER one, with no Munshi and "to the discard pile" wording, and was NOT used, since refreshing from it would regress the base.) Nothing implemented yet.
- **Wildcard spec corrected to match the engine (owner-side error fixed):** `M4B_SPEC_v1.2.md` A4 + Niyam Card 6 claimed all wildcards were universal — a "rules change shipped" under commit `4055711` with re-sim figures. Verified false: commit `4055711` never existed (full-history search, only `master`) and `placeableSets` (`sets.ts:30`) has been dual-restricted since M1 (source + git pickaxe + runtime all agree). Corrected to the built reality: **9 dual wildcards** place only in their two colours and carry a ₹ value (usable as payment at that value); **2 ANY wildcards** place in any set, are ₹0, and can never pay (`isAnyWildcard`); **no wildcard is bankable** (`BANK_CARD` excludes wildcards — `legal.ts:166`). Card faces stay as-is — dual = two-colour split + ₹ chip, ANY = all-colours band + "no value" — **not** unified. Matrix B7 checked (already defers to the legal groups; made explicit); STATE_MATRIX §3 test-gap findings for B14/B19/C4 are now closed by dedicated tests (commit `443e62f`).

## Rules — owner house rules (post-M4 freeze)

- **Overflow discards recycle under the draw pile (owner house rule):** end-of-turn hand-overflow discards (§4.4 step 4) go **FACE-DOWN to the BOTTOM of the draw pile** (in discard order), not the shared discard pile — so they recycle into future draws. The phase is unchanged: still mandatory + blocking (`handleEndTurn` forces `awaitingDiscard` while hand > `handLimit`), player still chooses the cards. **Scope guard:** ONLY end-of-turn overflow changes destination; played action cards still go to the discard pile, payments unchanged. First engine change since the M4 freeze — `reduce.ts` `handleDiscard` now `drawPile.unshift(cardId)` (top = last element, so front = bottom). **Hidden info preserved:** `observe` exposes only `drawPileCount`, never the buried cards' identity or order (asserted in `turn.test` #15). **Sims:** 1000-game bot sim unchanged vs baseline (95.8% win, 20.27 avg turns, longest 39, 0 violations, 0 unfinished — bots rarely reach the discard step, so self-play is unperturbed); the 500-game property run terminates < 500 turns with zero invariant violations (no deck-recycling infinite-game risk). `BUILD_SPEC §4.4` + `M4B_INTERACTION_SPEC §8` updated.

## Features — Munshi (in-game advisor)

- **Munshi advisor (owner call):** an offline, read-only in-game advisor (vintage-clerk framing). **3 uses per game, flat** — no ads/purchases/earn-loops/carry-over (no FOMO, project law). Available at any decision the human owns (turn, payment sheet, interrupt window). One use highlights the recommended legal option (reusing the existing gold legal-action glow) + one templated line of reasoning. **Shared brain with HeuristicBot (rationale):** the bot's ranking cascade was extracted into a single `recommend(observation, legalActions, difficulty)` in `@sauda/bots` returning `{ action, reason }`; `HeuristicBot.chooseAction` now returns `recommend(...).action` — **byte-identical** (1000-game sim unchanged: 95.8% win, 20.27 avg turns, 0 violations) — and `Munshi` consumes the same function, so bot and advisor can never disagree. Reasoning lines are a small template set keyed by the reason category (completes / denies / protects a set · best value · preserves a counter); no free-form/LLM, deterministic (same state → same advice). Structurally read-only — no `reduce`/`GameState` access. Module + unit tests shipped (`packages/bots/src/munshi.ts`, `munshi.test.ts`: 3-use budget, no-mutation, determinism, shared-brain, one per template); UI wiring is M4b. `BUILD_SPEC §8.4` + `M4B_INTERACTION_SPEC` updated.
- **Owner rules audit (pre-Munshi, all IMPLEMENTED — nothing changed):** (1) any action card bankable incl. NAHI CHALEGA, money forever — `legal.ts` offers `BANK_CARD` for any action; banked cards leave the hand and `legalActions` only builds plays from the hand, so a banked action is structurally unplayable. (2) NAHI off-turn, never a play — `interrupts.test` #8/#9 (off-turn responder + `playsRemaining` unchanged). (3) Payer alone chooses payment, no engine preference — `payment.test` `validatePayment` accepts any valid subset; `suggestPayment` is advisory only. (4) Properties never banked — `turn.test` "refuses to bank a property card" (`CANNOT_BANK`). (5) Nine centre plays vs MAKAAN/HAVELI attach-to-own-complete-set + bankable — `legal.ts` `actionCardPlays`/`buildableSets`; `turn.test` #13.
- **Munshi chip wired into the play screen (M4b Phase B).** The read-only advisor module (commit `fa3dd3b`) now surfaces as a compact gold chip (`◈` + one pip per unused consult) beside my "You" avatar in the A2 my-area header — left of the bank, clear of the reserved End-turn column; it does not push the layout or reintroduce scrolling (the `#/dev/frame360` scroll guard stays silent, and the bank total was pinned `nowrap`/`flexShrink:0` so the added chip can't reflow it). It is offered only on my own `'playing'` turn with legal moves; zero uses renders it spent + inert. Tapping calls `store.consultMunshi()` → the shared `recommend` brain → a read-only **"Munshi ki Salah"** card (recommended move + its templated reason line + Dismiss). **It NEVER dispatches an engine action** — proven in `store.test.ts` by the engine `state` object being reference-identical across a consult — so the player still performs the move; while open it is the one live decision surface (a SCRIM_SHEET scrim sleeps the hand / rail / sheet / prompt, law L2). **Advisor tier is fixed at `hard`** (defensible reading per CONTRIBUTING.md: the munshi gives the sharpest read of the table — it is the human's own clerk, not pinned to any one opponent bot's difficulty). The 3-use budget lives in the store (`munshiUsesRemaining`, a fresh `Munshi` per `newGame`/`reset`, no carry-over). `packages/engine` + `packages/bots` untouched — `recommend` and bot behaviour byte-identical; the only tests added are the store's uses-accounting + no-dispatch cases.

## Presentation batch (owner-approved; art QC complete) — CardFace only, no engine change

- **(A) Ledger slip — REVERSES the "no ledger wash" law above (owner call).** Reason: that law existed to keep batch art QC honest by forcing regeneration of any plate whose hero art intruded into the rent zone; **art QC is now complete**, so zero-regen robustness wins. Every property card's rent ladder + FULL SET rows now ride on a **uniform aged-cream "ledger slip"** (`ledgerSlipStyle` in `CardFace.tsx`): `rgba(238,229,205,0.93)` fill (~93% opaque so art only whispers through), 1px aged-line border, a pasted-slip drop shadow + faint inner age-stain for the worn edge. **ONE consistent treatment on all 28 property cards — never per-plate tuning.** Kiraya/Wildcard "ledgers" render on plain cream (no raster art behind them) and do not share the property ledger zone, so they need no slip. Verified before/after on the 3 deepest hero-art plates (`bangalore_1` 63.8%, `utility_0/1` 60.5%) + 3 shallow (`newDelhi_0` 45.6%, `newDelhi_2`, `kolkata_0`).
- **(B) Title swap — all 28 property cards.** The large letterpress title is now the **set / city name** (`SETS[set].label` → MUMBAI, KASHI GHATS, JUNCTIONS…); the small serif sublabel is the **locality** (`PROPERTY_NAMES[set][index]` → Marine Drive, Assi Ghat…). Presentation-only. The title zone is inset from the left (`left:43`) so it clears the enlarged value badge (C) — the two read as an emblem + title header, and cream titles never vanish onto the cream badge. `CardFace.test.tsx` updated to assert both.
- **(C) Value badge covers the plate circle.** The badge disc is fully opaque cream and enlarged to **36 units centred ~(23,20)** (was 20 units @ (20,19)). Measured across all 38 plates, the printed value circles sit slightly right-of-centre (~(20–25,18–21), up to ~28 wide; Junctions' is the largest/most offset); a 36-unit disc covers the worst case with margin. Verified on a 38-plate composite — no painted ring peeks out on any plate (property or crimson action banners).
- **(D) Rename: rent card → LAGAAN, dugna → DUGNA LAGAAN.** Player-facing display strings ONLY. `theme.ts` adds `KIRAYA_NAME = 'LAGAAN'` (single source; descriptor stays clean English per the language policy) and sets `dugna.name = 'Dugna Lagaan'`. Consumers updated: `CardFace` (rent-card title + MID/CHIP mini label `KIR`→`LAG`), `labels.ts` (mobile) and `render.ts` (CLI) `"KIRAYA (…)"` / `"Play KIRAYA"` → LAGAAN. **Unchanged on purpose:** structural card kinds `kiraya`/`dugna`, all card IDs, plate filenames, engine error strings (frozen engine internals, not player text). Munshi/bots reference only the structural keys, so advice is unaffected. ip-guard clean.
- **(F) Money plate wiring.** `plateKey(money)` now returns `money_<value>` (one painting per denomination — six keys `money_{1,2,3,4,5,10}`, same share-one-plate discipline as actions). The `import.meta.glob` registry auto-adopts each `money_<value>.webp` when it lands — zero code change. `MoneyFull` gains a note-plate branch: over the painted note (empty centre cartouche + four empty corner circles) the live layer drops the numerals only — large `₹N Cr` in the centre + a small bare `N` in each corner circle, IBM Plex Mono. Corner positions are best-fit and tunable when the art lands (as with the value badge). **The current plain gold-ruled note remains the fallback** and is what renders today (no money art on disk yet).

## M4b — Play screen (build, in phases)

- **Colour-literal ban (`tokens.test`) scope = `.ts`/`.tsx` only (Phase 1).** The visual-constancy guard (STATE_MATRIX §1 / v1.2 A5) scans `apps/mobile/src` for raw hex/rgb/hsl outside `design/tokens.ts` and fails on any hit. It excludes `*.test.ts(x)` (not rendered UI) and, deliberately, `styles.css`: its ~30 literals are legacy M3-plain styling being superseded by inline token styles. Migrating them to CSS-variables-fed-from-tokens is a later pass — so "colours live only in tokens" holds for TSX today, not yet for CSS.
- **Table skeleton dimensions from A2 zone percentages, not magic numbers (Phase 1).** The four zones are `flex-basis` 22/10/30/38 % of `min(90vh,780px)`; card sizes reuse `CARD.*` tokens scaled per zone (hand `HAND_SCALE 0.6`, mini-groups from a width arg). My area is always the largest (hierarchy law).
- **Two small A2 embellishments on my mini-cards (Phase 1, defensible reading):** I render a per-group **rent chip** (₹N from `myKiraya`) on *my own* groups — A2 lists mini-card contents as "count + FULL ribbon" but a rent read is useful and easy to drop; opponents' minis stay bare (the "mine larger/more detail" asymmetry). The **discard top face** reuses `STAGE.dimSleep` for its "quiet, desaturated" look rather than a bespoke token — fine while identical, split out if they diverge.
- **tap→stage→rail built as verb-rail + labelled drill-down chips (Phase 2; v1.2 A1, rows B1–B19).** Tapping a hand card raises it to the centre stage (light `SCRIM_DRAG`, table visible) with a right-hand rail of its legal verbs (Place/Build/Play/Charge/Bank + Cancel), exactly one gold-filled primary (`railForCard`, unit-tested). A verb with several concrete options (wildcard colours, LAGAAN colour/target/doubling, steal targets) drills down to labelled option chips — every option one `legalActions` action, label-before-commit. **Deferred to a follow-up:** on-board target *glow* (tap the actual set/opponent on the felt — B7/B13–B19), and drag / placed-wildcard rearrange (B8). **Interim:** the text `ActionPanel` stays mounted as the still-functional fallback (brief-sanctioned "existing controls stay functional") — it covers Draw / End turn / Declare / REARRANGE and any card until the rail fully replaces it; retires in the target-glow commit.
- **Payment sheet reads the debt from the observation, not a new engine field (Phase 3; C1–C3/C6; §6).** At `awaitingPayment` the engine opens the step and offers one pre-filled `RESPOND_PAY` (its `suggestPayment`); `observation.interrupt` carries the charge amount + creditor. `game/paymentModel.ts` `paymentDetails()` derives the debt + payable list, **reusing the engine's own `cardPayValue`/`isAnyWildcard`** (not a UI reimplementation of §4.5) — ANY wildcards excluded, `mustPayAll` when table ≤ debt. The sheet holds only selection state; `reduce` re-validates the submission. Unit-tested (`paymentModel.test.ts`, 5 cases). **Deferred:** C4 zero-payable auto-submit (the sheet currently shows an empty "Pay all I have" instead of auto-resolving), C7 received-wildcard placement (stays on the interim panel), and slide/fly motion (M4c). **Verification:** model unit-tested + typecheck/gate green; live visual check pending (a bot charging *me* is non-deterministic to force, and the browser session was unstable).
- **Interrupt prompt shows on an open response window, gated by hand-off (Phase 4; D1/D4; §7).** Rendered when `legalActions` offers `RESPOND_ALLOW` (a window on me) AND no pass-and-play hand-off is pending (E2 — private UI waits for the ack; in solo `handoffSeat` is always null). "Nahi chalega!" appears only when `RESPOND_NAHI_CHALEGA` is legal. The threat line was **extracted from ActionPanel to `labels.ts` `describeThreat`** (one source, shared by panel + prompt). A 10-s gold bar drains and auto-allows (D4) via a mount-once timer (latest-callback ref so re-renders don't restart it); chains (D3) reuse the prompt as each fresh window re-mounts it. **Deferred:** the NAHI-card hand glow (D1), and motion/haptics (M4c). The same `handoffSeat === null` gate was added to the payment sheet. Interim `ActionPanel` still lists the raw responses as the fallback.

### Phase A — retire the interim panel (landed)
- **The interim `ActionPanel` is retired.** Turn-flow moved onto the table itself (draw-by-pile-tap, End turn bottom-right, Declare SAUDA! centre, discard step) — all from `legalActions`; the "centre stage" placeholder and opponent letter-monograms were removed (A2 mini-cards = banner + count only). `describeAction`/`describePlayAction` deleted (only the panel used them).
- **Interrupt gate corrected (D1/D2):** the NAHI prompt opens **only** when `RESPOND_NAHI_CHALEGA ∈ legalActions` (I actually hold the counter); when only `RESPOND_ALLOW` is legal there is no prompt and the UI auto-plays it (D2). `ReceivePrompt` added for C7 (received-wildcard placement) so retiring the panel can't soft-lock.

### Phase B — drag-first layer (this pass; spec A10 appended, owner-approved)
- **A10 codifies the six UX laws L1–L6** (they were referenced by the owner's Phase-B directive but not yet written into the spec set; codified here per CONTRIBUTING.md "implement the most defensible reading and log it"). Drag supersedes A1 as the *primary* path; tap→stage→rail survives as the equal fallback; auto-draw (L4) supersedes draw-by-pile-tap; B8 rearrange = drag a placed wildcard between its legal groups (tap fallback).
- **Drop-map conflict — engine wins, flagged.** The Phase-B directive's drop map said "dual wildcard → bank = BANK (it IS bankable)". The **frozen engine** excludes every wildcard from `BANK_CARD` (`legal.ts:166`; A4 + Niyam Card 6 + STATE_MATRIX §3 all agree). Because the UI derives drop zones from `legalActions` only, the bank zone never lights for a wildcard by construction — no hardcoded rule needed. Dual wildcards remain usable as *payment* (on the table), never *banked* (from hand). Owner flagged.
- **UI-only interaction reducer** (`game/interaction.ts`, DOM-free, unit-tested): maps (dragged card / drop zone / tapped target) + `legalActions` → the exact engine `Action`, so the tap path and the drag path fire byte-identical actions (parity-tested) and an illegal drop produces no action. TARGETING is a progressive pick over the engine's already-enumerated actions, so `BAD_TARGET` is unreachable from the UI.
- **Phase-B verification pass (deterministic capture + audit).** Closed the two honest Phase-B gaps (flaky screenshots; D1 never driven live) with a seeded scenario harness (`tools/src/scenarios.ts` + `tools/fixtures/scenarios.json`) that finds a reproducible seed+turn+action-log for each of 14 target states, and by driving the real UI onto each through `#/dev/frame360`. Added a **dev-only store hook** (`if (import.meta.env.DEV) globalThis.__sauda = useGame`) so a recorded log can be replayed into the store from the browser — Vite strips it from the production bundle. Audit vs `M4B_SPEC_v1.2`/`STATE_MATRIX`: all 8 checks PASS (no page scroll in any state; 11-card fan fits; End-turn column never overlaps the fan; one live surface per L2; auto-resolves emit a beat+ticker per L1; **bank rejects a wildcard at runtime** — canon proven; only legal targets glow; >7 discards bury under the draw pile per house rule `813f1cd`). No spec bug found → no Task-D fixes. Soak: 1000 games reproduces the baseline **exactly** (95.8% / 20.27 turns / 0 violations); 2000 games 0 violations. Full report in `docs/PLAYTEST_PHASE_B.md`. `packages/engine` + `packages/bots` byte-identical throughout.
- **Wildcard-bankable canon re-verified (docs-only pass).** An architect handoff doc labelled the 9 dual wildcards "bankable" — wrong. A ground-truth grep of `docs/` found every wildcard/bank instance already correct (BUILD_SPEC §4.4/§4.5, M4B_SPEC_v1.2 A4 + Niyam Card 6, STATE_MATRIX §3; the only "bankable" mentions are self-correcting flags), so nothing was reworded. Canon restated for the record: **a dual wildcard carries a ₹ value and IS usable as payment *from the table*, but is NEVER bankable *from hand*; ANY wildcards are ₹0 and are neither bankable nor payable** (`BANK_CARD` accepts only money / action / kiraya — `legal.ts:166`). The **engine was always right and never changed** — documentation correction only, no source edit.

### Phase B close-out — committed capture pack + flag rulings (this pass)
- **Capture pack committed (closes report flags 1 & 5).** A headless, rerunnable Playwright pipeline (`pnpm capture` → `apps/mobile/scripts/capture.mjs`, chromium devDep) drives the real UI at an exact 360×740 viewport (deviceScaleFactor 2, reduced-motion) via a new dev-only `window.__replay(seed, actions)` hook and shoots one PNG per state into `docs/captures/` (14 fixture states + 6 composites incl. the three mid-drag glow frames, plus `INDEX.md`). Flag 1 (no committed images) and flag 5 (mid-drag glow never imaged) are closed. The mid-drag frames use **real pointer input** (down → past the 8 px slop → hold → shoot → release in dead space, state unchanged); the C4/NAHI beats are held by a dev **capture-freeze** that pauses the bot timer / auto-draw / auto-resolve. All hooks are `import.meta.env.DEV`-gated and **tree-shaken from production — the prod bundle is byte-identical** (`index-*.js` sha1 unchanged before/after). `packages/engine` + `packages/bots` untouched.
- **Flag 2 — Munshi tier stays `hard` regardless of table difficulty [RULED].** The advisor gives advice at FULL strength on every table; advice quality never degrades to match easier opponents. It is the human's own clerk (sharpest read of the table), not pinned to any one bot's difficulty. (Confirms the tier choice already noted under "Features — Munshi".)
- **Flag 3 — compact `◈`+pips chip is FINAL for M4b [ACCEPTED].** The worded "Munshi" label wrapped the bank total; the name lives on the advisor card ("Munshi ki Salah") and the chip tooltip, and the Learn screen (M4d) introduces the advisor properly. No header-width reclaim in M4b.
- **Flag 4 — payment sheet internal scroll is spec-compliant [RULED].** The A2 no-scroll law governs the **play surface** (the four zones); a **modal overlay** (payment sheet / prompt / advisor) MAY scroll **internally** when its content overflows — the table beneath never scrolls. One clarifying sentence added to `M4B_SPEC_v1.2.md` A2 so a future session never "fixes" this. Capping/paginating a modal is a later design choice, not a compliance bug.
- **Flag 6 — drag-glow vs tap-rail targeting stays AS IS [PARKED to polish].** Both paths are correct and parity-tested (`interaction.ts` derives every move from `legalActions`, so drag and tap fire byte-identical actions and BAD_TARGET is unreachable). Unifying the two targeting UIs is deferred to the polish pass — not a bug, no change this pass.
- **Flag 7 — 11-card fan crowding left to the owner [NO ACTION].** Spec-compliant (all cards partly visible, no scroll — see `docs/captures/S10_eleven_cards.png`); the owner judges the visual density in his own playtest.

## M4b — owner playtest fix pass (30 Jul)

Seven findings from the owner's first real playtest, each fixed and proven with a before/after image pair in `docs/captures/playtest-fixes-1/`. `packages/engine` + `packages/bots` byte-identical throughout; no motion/sound (M4c); tests 206 → 247.

- **F1 — hand fan (owner playtest 30 Jul):** extracted the fan geometry into a pure `fanLayout(n, width, cardWidth)` with the invariant NOTHING CLIPS (rotated boxes inside the frame, tilt capped |5°|, cards shrink for a dense hand), unit-tested for n 1..12 at width 346/436. Added the SCRUB pickup (peek under the pointer → lift into the drag → release-in-band taps); discard mode uses the same fan. The ~90ms peek ease is deferred to M4c. Spec: `M4B_SPEC_v1.2.md` A12.
- **F2 — auto end-of-turn (owner playtest 30 Jul):** when the human's `legalActions` is exactly `[END_TURN]` the UI ends the turn after an ~800ms "Turn over" beat and hides the manual button; anything else legal keeps it manual so a win / free wildcard move is never eaten. Pure `shouldAutoEndTurn` condition matrix unit-tested. Spec: A12 (an A10/L4 refinement).
- **F3 — payment default + disclosure (owner playtest 30 Jul):** AUDIT proved the shared `suggestPayment` is NOT at fault (2638 charges, 443 minimal overpays, 0 with a smaller sufficient table subset), so the engine is untouched. Added a UI-side money-first `refinePaymentSelection` (never overpays when an exact subset exists — 400-hand property test) + progressive disclosure (money shown; other property sets behind a "Pay with property instead" expander). Spec: A12.
- **F4 — real cards everywhere (owner playtest 30 Jul):** every committed play (human too, not just bots) now holds its real CardFace on centre stage for a beat (spotlight extended to BuildingPlaced + keyed to the acting player); opponent hand-count pips skip the downscaled raster below 24px for a crisp tile. The payment sheet already rendered CardFaces (F3). Money-note art stays the fallback plate (M4a).
- **F5 — opponent row (owner playtest 30 Jul):** in-play pills show the NAME only (difficulty is a setup concern); an opponent's sets ride ONE adaptive row that never grows the 22% zone — mini-cards shrink to fit, and below a legible minimum the overflow collapses into a gold "+n" chip (`OpponentGroupStrip`).
- **F6 — end card + scroll bug (owner playtest 30 Jul):** the end-state page-scroll was the old in-flow `.winner` strip stacking on the full-height board (778 > 740px). Replaced with a `position: fixed` full-screen end overlay (dimmed board, tokens panel, title + the winner's three set banners + a tokens New game control) — out of flow, so it can't grow the page. Root cause + fix proven by the scroll guard (warns 778>740 before, silent after). Spec: A12.
- **F7 — why-lines on the rail (owner playtest 30 Jul):** when a staged card's canonical verb is absent from `legalActions`, the rail shows one greyed, non-tappable reason (`labels.ts` `cardVerbHint`, UI copy only) — MAKAAN "needs a complete set", HAVELI "needs a MAKAAN first", KABZA "no full set to seize", HAATH KI SAFAI "nothing stealable", ADLA-BADLI "needs one of yours + one of theirs", LAGAAN "no matching property". Verified (tests) that money-on-property and property-on-bank fire no action.

## M4b — owner playtest 2 ("real cards, real wheel"; 30 Jul)

Second owner playtest. The core hand-input model changed, the fan became a wheel, the two bare card
families were finished, and real cards were made visible everywhere. Spec: `M4B_SPEC_v1.2.md` A13.
`packages/engine` + `packages/bots` byte-identical throughout. Captures: `docs/captures/playtest-fixes-2/`.

- **G1 — the hand-card RAIL is retired (owner playtest 2, 30 Jul).** Tapping a hand card now INSPECTS
  (read-only, no buttons, no engine action); DRAG (from the wheel or the inspected card) is the only
  commit path from hand. The A1 tap→stage→rail survives in the spec only as history. `ActionRail.tsx`
  + `StagedCard.tsx` (the rail UI) were deleted, but `staging.ts` (`railForCard`, the legal-verb
  grouping) and its 7 tests were KEPT — the inspect why-line reuses it to detect a missing canonical
  verb, so no test was deleted and no code is dead. `interaction.test.ts`'s drag/tap PARITY suite
  became a drag-COMPLETENESS suite (every enumerated hand play is drag-reachable; illegal drops fire
  nothing) — same `it` count.
- **G2 — the WHEEL replaces the fan (owner playtest 2, 30 Jul).** `fanLayout` + `HandFan` retired
  (fanLayout.test's 26 tests removed with the retired geometry); `wheelLayout` + `HandWheel` added
  (wheelLayout.test's 30 tests). Geometry constants (SPAN_MAX 120°, COMFORT_STEP 12°, hub radius
  0.42·cardHeight, card width clamp 58–78) are the most defensible reading of the owner's "one
  geometry, one size, near-semicircle for many cards" — chosen so the no-clip invariant holds at both
  test widths, unit-proven rather than eyeballed. The redistribution glide (transform-only ~175ms) is
  the ONE motion carve-out; the peek stays instant (inner layer, no transition) so it doesn't ride
  the ease.
- **G3 — discard is a full-screen L2 overlay (owner playtest 2, 30 Jul).** Replaces the inline
  discard-via-fan. Under-pile routing is the frozen engine's (turn.test #15); the overlay adds the
  count-down + per-card DISCARD dispatch (unit-tested) + a ticker line (new `CardsDiscarded` case).
- **G4 — real-cards LAW (owner playtest 2, 30 Jul).** Every card everywhere renders through CardFace
  (full, scaled by the new `ScaledCard`) or CardBack. CardFace lost its MID/CHIP symbolic branches,
  the `size` prop, and `heldCount`; tokens lost `CardSize`/`cardWidth()`/`midWidth`/`chipWidth`.
  On-board sets are compact real-card cascades (`SetCascade`) with a SET-rent badge; the full readable
  view is the tap-to-expand `TableView` (opponent row or my group → L2 overlay). "SET ₹N" on a
  wildcard row is the FULL-SET RENT (the codebase's own convention, matching PropertyFull's ledger;
  the owner's "Rs4" example was illustrative, not a spec on the number).
- **F4 REGRESSION root cause (owner playtest 2, 30 Jul).** F4/F3 rendered payment options via
  `<CardFace size="mid">` (`PaymentSheet.tsx:76`), and the F4 DECISIONS note "the payment sheet
  already rendered CardFaces (F3)" treated any CardFace call as real — but `size="mid"` was `MidFace`,
  a symbolic banner+pips / "₹N Cr" / "LAG" stand-in. F4 changed WHERE cards appear (the stage beat)
  but never the symbolic render path, so the owner's screenshot showed cream rectangles. Fixed under
  G4 by routing every surface through the full face.
- **Zone retune (owner playtest 2, 30 Jul).** Within the ±6% budget: opponents 22→21, table band
  10→9, centre stage 30→28, my area 38→42 (still the largest). The wheel spans the full my-area with
  the hub at bottom-centre; End turn floats in the clear bottom-right corner (cards converge to the
  hub; F2 auto-ends most turns so it is usually hidden). Nothing scrolls in any state.
- **G6 — received cards on the stage (owner playtest 2, 30 Jul).** Evidence (`payment.ts`
  `routeCardToCreditor`): only a WILDCARD received in payment is a placement CHOICE (`awaitingReceive`
  → one `RESPOND_PLACE_RECEIVED` per `placeableSet`); properties auto-place (`CardReceived`);
  money/action/kiraya go to the bank. A stolen/swapped card (KABZA/HAATH/ADLA-BADLI) follows the SAME
  split — **[corrected J5; the original "steals auto-place" was imprecise]**: `reduce.ts`
  `moveCardToCreditor` auto-places a stolen *property* (`CardReceived`, returns no pending choice) but
  a stolen *wildcard* opens the very same placement CHOICE (`awaitingReceive`, one
  `RESPOND_PLACE_RECEIVED` per `placeableSet`) because it can join either of its colours — the on-stage
  received flow already handles it (proven by the seed-1 HAATH-steal capture). So the on-stage
  placement flow is exactly the received-wildcard case; auto-placed property arrivals get a stage beat +
  ticker line. Engine untouched — presentation over `legalActions` only.
- **G7 — Munshi's pick marker is static (owner playtest 2, 30 Jul).** A gold ◈ seal on the suggested
  cards + a "Munshi's pick — tap Pay" line. The bouncing arrow is guidance juice → `M4C_MOTION_BACKLOG.md`.

## M4b — excellence pass (H, 31 Jul)

Evidence-first pass. Clips + measurements in `docs/captures/excellence-pass/`; engine + bots byte-identical throughout.

- **H2b — End turn gets ONE fixed slot in the my-area header, clear of the wheel (reverses the pass-2 corner float; honest history).** Pass 1 reserved a ≥88px right column so the hand could never underlap End turn; pass 2's full-width wheel DELETED that reservation, floated End turn in the wheel band's bottom-right corner, and waved off overlap as "usually hidden (F2 auto-ends)". Measured, that corner is NOT free: the splayed readable tops of the outer wheel cards run through an ~84×44 button at `right:4/bottom:8` at **n=5..12 @ container 346** and **n=9..12 @ 436** (4 cards overlap live at n=11), and because the button carries pointer events it also BLOCKED scrubbing those cards. "Usually hidden" is not an invariant. Ruling: End turn moves to the my-area header row by the bank — a compact pill that never grows the header (the wheel keeps its full vertical budget) and lives in a band the wheel never reaches; `SPAN_MAX` stays 120 so the wheel stays widest. Declare SAUDA! already lives clear in centre stage (A11, the one celebratory button), so it needs no move. No-overlap proven in `wheelLayout.test.ts` (the old in-band corner overlaps a card at many n; the header slot overlaps none at any n∈1..12 @ {346,436}). [`Board.tsx` `endTurnButton`]
- **H2a — manual EARLY end is NOT dead (audited; not a regression).** The engine offers `END_TURN` unconditionally during `playing` (`legal.ts:135`, outside the `playsRemaining>0` block); `shouldAutoEndTurn` returns true ONLY when `legalActions` is exactly `[END_TURN]` (`interaction.ts:283`); the button renders whenever `endTurnAction && !autoEnding` (`Board.tsx`). So with plays remaining, `autoEnding` is false and the manual End turn is visible + reachable — ending early while holding plays back is always possible. Proven by clip `H2_endturn_early`.
- **H3 — wheel legibility tuned to the my-area ceiling; the value badge is flagged.** At 360×740/DPR2 the wheel band is capped by the my-area vertical budget (~142px; the on-board group cascades — frozen this pass per H6 — take the rest), so the only lever is hub depth. Reduced `HUB_RADIUS_RATIO` 0.42→0.34 and the card-width fraction 0.20→0.21 (the largest that still passes no-clip at both board widths), lifting the rest card 66→69px. Rendered set-name banner **9.0→9.4 device px** (bar ≥9 ✓); visible strip **≥88.3%** at every n≤12 (bar ≥26 ✓). Value-badge numerals reach only **7.3 device px** (bar ≥10 ✗) — geometrically unreachable in the wheel: ≥10 needs a ~94px card → ~201px band, 59px over budget (would scroll, violating A2) and clips the arc at n≥11; the 7px badge font is a locked face (A-batch item C). Full value legibility is on tap-to-inspect (~56% frame width). FLAGGED for the owner. [`wheelLayout.ts`]
- **H1a — opponent boards are visibly tappable (were cursor-only).** Audit: opponent expand was wired (`onClick` at `Board.tsx`, `cursor:pointer` at `BoardParts.tsx`) so it worked, but the only affordance was the hover cursor — invisible on touch, which is why the pass-2 report said "only my groups carry the affordance." Fix: the WHOLE opponent column is the tap target and its pill carries a visible gold ⤢ expand glyph, so it reads as "tap to open" on touch. Opens the same read-only TableView (their sets as large real cards + bank total). [`Board.tsx` opponent column; `BoardParts.tsx` `PlayerHeader expandable`]
- **H5 — bot pacing is ONE constant table (functional tempo).** Flat 700ms/beat gave a median inter-turn wait of 4.2s and p95 10.5s (the "6-8s dead time" the owner flagged — worse at the tail). Replaced with a paced table (`interaction.ts` `botBeatDelayMs`): the FIRST beat of a bot's turn holds 700ms (so its start reads), subsequent beats 450ms, floor 350ms, and beats trim toward the floor as a turn nears a ~3s presentation cap — never skipping a card. `Table.tsx` paces per bot turn via a beat ref that resets when control leaves the bot. Measured over 60 seeded games (1093 inter-turn gaps, `tools/src/measure-pacing.ts`): median **4.20→3.45s** (−18%), p95 **10.50→7.55s** (−28%), max **14.70→11.00s**. Each bot turn is still fully shown; the owner vetoes in playtest if it feels rushed.
- **H4 — performance to budget on a 4× CPU-throttled late-game board (`S6_haveli`).** Pass 2's MID/CHIP deletion made every surface a full CardFace + webp plate; profiled and fixed. (1) **Memoisation:** `CardFace` + `ScaledCard` + `SetCascade` are `React.memo`. During a 24-move drag the board's CardFace renders dropped **216→2** (dev counts, StrictMode-doubled — only the dragged preview re-renders); the real-card cascades no longer re-render per pointermove, only the dragged layer + zone glows update. (2) **Plates:** all 45 (600×870 webp) are fetch-preloaded at game start — retaining the `Image` refs so GC can't cancel the in-flight fetch (that bug left money plates uncached); mid-game plate network fetches **3→0**. (3) **Frame p95 (4× throttle):** wheel glide **33.4→16.8ms**, active drag 16.7ms, bot beats 16.8ms, TableView open/close 16.8ms — all within the 16.7ms target. (4) **ScaledCard method — KEPT transform-scale** of the full 132px DOM face (the G4 "one design, pixel-identical at every size" law): at DPR 2/3 the face renders at 264/396 device-px then GPU-downscales (crisp vector text + downsampled plate), the scale is a cheap compositor transform, and a native-small render would still decode the full webp (no memory win) while duplicating the size logic and risking sub-pixel font rounding. **Image memory:** 3.36MB encoded cached; a full decode of all 45 would be ~90MB RGBA (≈2MB/plate) so decode stays async-per-display (`<img decoding="async">`), not forced up front (downscaled plate variants are the M4c fix if on-device decode hitches show). **DOM:** 1430 nodes on the late-game board — not wild, no trimming. **FLAG:** two one-frame TRANSITIONS still breach the 33ms ceiling under 4× throttle — a play-commit that triggers the glide (66ms) and the TableView open that mounts ~10 large cards (83ms); sustained interaction is within target, these are mount/commit costs (progressive mount / lighter open = M4c motion). [`CardFace.tsx`, `SetCascade.tsx`, `plates.ts`, `renderTally.ts`]
- **H6 — wildcard rows keep FULL-SET rent [RULED, pass-2 flag 5].** The "SET ₹N" line on a dual/wild LAGAAN or wildcard face is the FULL-SET rent, matching the FULL SET row convention on every property face's ledger (the owner's "Rs4" was an illustrative example, not a spec on the number). No change — the faces are correct and now locked (G5). Confirms the pass-2 note.
- **H6 — on-board cascade SIZE stays OPEN [awaiting owner, pass-2 flag 2].** How large the placed-set cascades render on the board (vs the tap-to-expand TableView) is a design-density call for the owner's playtest; unchanged this pass. It also bounds the wheel's vertical budget (see H3), so any future change is joint.
- **H7/H2b follow-up — decluttered my own header so End turn fits without colliding with Munshi.** The H7 audit caught the relocated End turn overlapping the Munshi chip (the header was too wide: You-pill + hand-count card-backs + play pips + Munshi + End turn + bank > 360px). Fix: my OWN `PlayerHeader` (`self`) drops the hidden-hand card-backs (I see my hand in the wheel) and the play pips (plays-left already reads in the table band, and the pips clashed with the Munshi chip's pips). Opponent pills keep the card-backs (their hands are hidden). Measured after: Munshi ends x136, End turn starts x165 — 29px gap, no overlap at any bank total; the Munshi advisor is clickable again. [`BoardParts.tsx PlayerHeader`]

## M4b — close-out pass (J, 31 Jul)

Converts the excellence pass's open flags into finished work and hands the game to the owner's phone. Engine + bots byte-identical; full-size card faces byte-identical; no M4c juice, no M4d screens. Measurements in `docs/captures/m4b-closeout/`.

- **J1 recategorisation — the two flagged transitions were PERF work, not M4c.** Deferring the 83ms TableView-open and 66ms play-commit-glide (both over the 33ms core-interaction ceiling under 4× throttle) to the juice milestone was a category error: they are mount/commit costs, not motion design. FIXED this pass, not parked. Root causes (measured with per-interaction render tallies): (a) the glide-commit re-rendered ~44 `SetCascade`s because the engine rebuilds every `PropertyGroup` identity per dispatch, so the reference memo missed on every commit → gave `SetCascade` a **content** comparator (compare cards/buildings ids, not identity), dropping commit cascade re-renders **88→0** and the glide-commit worst frame **66→17ms**; (b) TableView-open painted all ~10 large cards in the one frame that also carries the board re-render + backdrop-blur setup → **reveal groups one-per-frame starting from ZERO** (frame 1 = shell only), dropping open worst frame **66→17ms**. p95 for every interaction ≤16.8ms (< 33). [`SetCascade.tsx`, `TableView.tsx`]
- **J2 recategorisation — plate memory was ASSET engineering, not M4c.** The ~52MB of decoded bitmaps a late-game board pins (measured; cards drawn 14–38px each still decoded the full 600×870 → ~2MB) is a real M5 budget-WebView risk, and downscaled variants are a build pipeline, not juice. Added `scripts/build-plate-variants.mjs` (sharp) deriving **160w + 320w** webp tiers of all 45 plates into `assets/plates/variants/<w>/`; the source plates are untouched (variants are pure build outputs). Because the faces are drawn at 132 and transform-scaled, `srcset` can't respond — selection is an EXPLICIT hint: `ScaledCard`/`HandWheel`/`CardBack` pass the on-screen width down, `plateVariantUrl` picks the smallest tier covering width×DPR (`chooseVariantWidth`, unit-tested), else the source. Decoded board memory **51.77MB → 4.11MB (−92%)**; tier bytes 160w 319KB / 320w 1115KB total. [`plateVariants.ts`, `plates.ts`, `CardFace.tsx`]
- **J3 — value-badge legibility floor, built behind a toggle, DEFAULT OFF (owner rules).** H3 flag 1: the wheel value badge measured 7.3 device px against the 10px bar and geometry alone can't reach it. Added a scale-aware floor (`badgeFloor.ts`): below the scale where the numerals would drop under 10 device px, the badge grows (anchored at its corner — the map-label pattern) so they hold at exactly the floor. Applies to SCALED renders only; the full-size face is byte-identical (proven — the OFF/ON dev-card screenshots hash equal). Ships OFF (`BADGE_FLOOR_DEFAULT=false`); a `?badgeFloor=1` param flips it for the A/B stills (`docs/captures/m4b-closeout/badge-floor/`, wheel n=7/n=11 + a board cascade). The owner picks from the stills; the default is not flipped here. [`badgeFloor.ts`, `CardFace.tsx ValueBadge`]
- **J4 — the game on the owner's Android phone.** `pnpm dev:lan` (vite --host, pinned 5174) + `pnpm phone` (LAN URL + terminal QR via `qrcode-terminal`); USB `adb reverse tcp:5174 tcp:5174` fallback for client-isolating wifi. Both documented in `docs/PHONE_PLAYTEST.md`. Verified off-localhost breaks nothing dev-critical: `__replay`/`__saudaCapturePaused`/autostart are hash-based + in-page + `DEV`-gated, plate URLs are root-relative (`import.meta.glob ?url`), vite `base` is `/`, and no absolute host string exists in `apps/mobile/src`. Touch audit: all gestures already use pointer events (`useFanGesture`/`useHandDrag` + `setPointerCapture`), drag/wheel layers set `touch-action:none`, `contextmenu` is suppressed on every draggable, and there are no hover-only handlers — the one cursor-only sibling of the H1a find (my OWN groups were tap-to-expand via `cursor`+`title` only) got the same visible ⤢ affordance opponents got. [`BoardParts.tsx MiniGroup`, `phone-connect.mjs`]
- **Relevance-weighted bot pacing — IDENTIFIED and PARKED (pending the owner's phone-playtest verdict on H5 pacing).** Idea: instead of the current uniform beat table, weight a bot beat by how much it concerns the human — a FULL beat only for plays that TARGET the human (a charge/steal/swap against me, which I must see), the FLOOR beat for neutral plays (a bot banking or placing its own property). This would tighten dead time further without hiding anything that matters to the human. NOT implemented — H5's flat paced table is the current baseline and the owner may find it already good on-device; if the phone playtest says bot turns still drag, this is the first lever to pull. [would touch `interaction.ts botBeatDelayMs` + the beat driver in `Table.tsx`]

## M4 — feel + shell pass (K, owner reorder 31 Jul)

Pulls the motion-continuity slice of M4c and the Home/Learn slice of M4d forward, per the owner's
phone-era verdict ("binary and Mario-esque; the entry point should be a game, not a config page").
Part 1 (K1–K5, feel) built + committed before Part 2. Engine + bots byte-identical throughout;
full-size card faces byte-identical. Spec laws in `docs/M4B_SPEC_v1.2.md` §K.

- **K1 — drag physics LAYERS on the oracle, it does not replace it (owner reorder, 31 Jul).** The
  spring/magnet/fling live in one controller that all four drag sources feed; the tap-vs-drag split
  and the commit contract are unchanged — a commit still only ever fires `onCommit(cardId, zoneId)`
  for an ELIGIBLE zone the caller derived from `legalActions`. Fling adds a way to CHOOSE an eligible
  zone (fast flick within a 30° cone of exactly one), never a new zone; the magnet leans the RENDER a
  few px and lights a zone hot early but never commits on its own (commit stays release-over-zone OR
  fling). So "illegal zones never attract/accept" holds by construction. The under-pointer hit-test
  stays at the raw finger (parity with the old DOM test); the assist lean is display-only. Pure parts
  unit-tested; the rAF controller proven by a live drag (no errors, no accidental commit).
- **K2 — the dimmed-Rs10-behind-ticker bug was an OVERSIZE overflow, not a scrim (owner reorder, 31
  Jul).** Measured: the 112px stage spotlight (→162px tall) overflowed the ~117px play band by ~22px
  into the ticker row above. Fix: a `StageSpotlight` that FITS the card to the whole stage zone
  height (measured), sits above the ticker (z 4) with its own gold glow, and is exempt from the
  my-area sleep dim (it is a sibling of the stage, not inside my-area). Verified on-device it lands
  ~91–112px, fully within the stage. Bot AND human plays now reveal-on-stage then travel toward the
  actor's board (opponent up / me down) — driven by the same `lastPlayedCard` events, no fragile
  cross-container rect tracking.
- **K2 — surface eases are ENTER-ONLY by scope (owner reorder, 31 Jul).** `Surface` fades+scales a
  panel in on mount; an accurate reverse-OUT would mean threading a two-phase close through every
  overlay's gate. The enter ease is the felt win (nothing pops); exit staying instant is a documented
  line, revisitable in M4c. `prefers-reduced-motion` collapses all of it via one switch
  (`design/motion.ts`).
- **K3 — AUTO-END v2 supersedes F2's sole-action rule AND H2b's End-turn slot (owner reorder, 31
  Jul).** The turn no longer auto-ends from `Table` when `legalActions == [END_TURN]`; instead the
  turn TOKEN owns the end. New rule: with 0 plays and no declarable win, a ~2.5s drain ends the turn
  (pausable by a rearrange drag, tappable to end now). The edge case "plays remain but nothing is
  playable" now ends via the token's arm-tap rather than auto — matching the owner's explicit
  plays==0 tie. `interaction.ts shouldAutoEndTurn` is retained (still a valid, tested pure helper) but
  is no longer wired to the UI. The centre-stage Declare SAUDA! button is REMOVED — the token becomes
  the declare (the owner's "the token becomes the gold SAUDA! declare"); A11's "one celebratory
  centre button" is superseded. Plays are spent-counting (three circles fill as plays are used), and
  the You-chip play pips are gone (the token is the sole plays indicator).
- **K4 — the bank tray IS the drop zone (owner reorder, 31 Jul).** `data-drop="bank"` moved onto the
  tray so its rect (which grows when a bank drop is eligible) is what the hit-test and the K1 magnet
  read — the magnet follows the expanding landing strip for free. The old `BankStack` (stylised cream
  rectangles + a dashed ₹0 box) is retired; the tray shows real mini faces (bank is public) and a
  quiet embossed empty state. A raw colour literal I first used for the tray well was rejected by the
  tokens-only guard test and replaced with `STAGE.scrimSheet`.
- **K5 — crispness via CSS `zoom`, not a re-authored 264 base (owner reorder, 31 Jul).** CardFace has
  ~61 hardcoded px sizes; re-authoring them to a metric-doubled base is high-risk. The spec allows
  "native-width rendering — implementer's call." `ScaledCard` now UPSCALES via `zoom` (which
  re-lays-out the face so text rasterises at native device pixels — crisp) and keeps `transform` only
  for downscaling (H4). Verified live: the 200px inspect renders at `zoom 1.515` and there are ZERO
  transform-upscaled faces on screen. TableView gained tap-anywhere-off-a-card dismiss (only cards
  swallow the tap) + an explicit ✕, a ≥96px card floor, and internal scroll for a rich board.
- **Dev-server HMR churn during the K run (housekeeping).** Rapid sequential edits to `Board`/`Table`
  left Vite's HMR replaying stale transforms (old `?t=` versions) that React recovers from — noisy
  console, working UI. A dev-server restart clears it; source + production build are clean throughout
  (verified per commit). Not a code issue.

## PHONE-1 — real-device recovery + shell (owner phone test 1 Aug)

- **The void was two bugs, not one (P1).** The centered `min(96vw,460px) × min(90vh,780px)` board
  left felt margins on every side AND the fixed 28% centre stage was empty when idle. Fixed both: a
  full-bleed 100dvh shell (no margins) and a clamped-flex zone law where the idle stage collapses to
  its content. The remaining open space at game start lives in MY AREA (surplus flows there first, per
  the owner's ask) — that is the property board where deeds land, labelled by the ticker, not a void;
  it fills as you play and is consumed by the P3 inflated drop band during a drag.
- **Zone heights are JS-computed, not pure CSS flex (P1).** Pure `flex` min/max would render the
  clamp but can't be unit-tested and could drift from the HUD/capture numbers. `resolveZones()` is a
  pure function the board applies as explicit px heights, so the law is provable and the on-device
  numbers match it exactly.
- **The dark-slab root cause was the inspect scrim, not the drag placeholder (P2).** The owner's
  "dark slab over the wheel during a drag" was `InspectCard`'s full-board 8% scrim staying mounted
  after a drag started from inspect. Fix: the scrim goes transparent while the card is carried. The
  "sleep scrim on my hand during my turn" did NOT reproduce — the dim is gated on `!myTurn`.
- **Local card-stacking stays computed; only literals are banned (P2).** The eslint z-index gate bans
  literal `zIndex:` numbers but allows computed ones (`zIndex: index`, `isPeek ? …`), which are
  legitimate within-component stacking (the fan order, the cascade order) relative to their own
  context — they are not part of the global overlay scale.
- **Near-miss forgiveness is unambiguous-or-nothing (P3).** A slow release commits to an eligible zone
  within 120px ONLY if exactly one is near; two or more near returns null (spring home), so it never
  guesses the wrong set. Same rule as the fling cone.
- **Reduced-motion drag-commit was silently broken; fixed under P3/P4.** The controller stored no
  physics state under reduced motion, so a reduced-motion release cleared the preview WITHOUT
  committing — drops did nothing. Now a `reducedCarry` ref lets a reduced-motion release hit-test,
  forgive a near-miss, commit, and report a miss — same outcomes as the animated path.
- **Micro-audio deferred, not stubbed (P5).** "Defer with a flag" was interpreted as a documented
  deferral (this entry + the report), not an unwired WebAudio module — shipping dead code would
  violate the readability contract. It is a one-file add + light wiring when picked up.
- **P7 handle lives in MiniGroup, not SetCascade (P7).** SetCascade is H4-memoized on content; adding
  per-card drag handlers there would break the memo (fresh closures) and re-run ~44 cascades per
  commit. The ◈ handle renders in the (un-memoized) MiniGroup wrapper instead — same drag/tap paths,
  no perf regression.
- **The Book's win count is a labelled literal (P8).** Every Book number is derived from engine
  constants EXCEPT "3 complete sets of distinct colours", which lives inline in `sets.ts`
  (`hasThreeCompleteSets`) with no exported constant. Since the engine is byte-identical-locked this
  pass, the Book mirrors it as a clearly-commented `SETS_TO_WIN = 3`; everything else is computed.
- **P6 (Munshi redesign) NOT done this pass.** The advisor's advice LINE is generated in
  `@sauda/bots` (Munshi.advise), which is byte-identical-locked, so its copy can't be rewritten here;
  and the layout redesign is polish on an already-functional consult-only surface. Deferred behind the
  higher-value rage fixes (P1–P4) and the front door (P8). Logged as a remaining flag.
- **`useHash` reads the live hash each render (P8).** Rather than cache the hash in state (which races
  the newGame re-render and depends on jsdom firing hashchange), the hook returns `window.location.hash`
  live and uses the event only to force a re-render — so KHELO's `newGame()`-then-set-hash lands on
  #/play on the very next render.

## PHONE-2 — close the PHONE-1 gaps (owner phone test 1 Aug, follow-up)

- **Munshi advice copy is UI-layer, not a bots rewrite (Q2 — the PHONE-1 P6 reasoning was wrong).**
  The byte-identical bots lock protects the bot's BEHAVIOUR — `recommend()` decides which move and
  tags it with one of six `reason` enums. The human-facing SENTENCE is display copy, so it maps in
  the mobile layer (`labels.ts:munshiAdviceLine`), exactly like card/set renames do, leaving
  `packages/bots` untouched. `Munshi.advise` still returns its own `line` for the CLI/tests; the
  phone UI ignores it and renders the rewritten copy. So P6's "can't rewrite the copy under the
  freeze" was mistaken: the freeze never covered display strings.
- **The advice card is a non-overlapping flex row (Q2).** The owner's screenshot showed pips/mini-cards
  over the advice text. The rebuilt card is one `flex` row — medallion left, `minWidth:0` centre
  (so the sentence WRAPS instead of shoving the card off), ScaledCard `flexShrink:0` right — which
  makes overlap structurally impossible at 360px and 412px alike. No absolute positioning.
- **The medallion is asset-or-silhouette (Q2).** It loads `assets/plates/munshi.webp` via the same
  zero-config plate glob the cards use (dropping the owner's lithograph in needs no code change), and
  falls back to a code-drawn vintage bust in a gold ring so the advisor always has a face. Its idle
  float is transform-only (`translateY`, GPU-composited) and is not applied under reduced motion,
  with a `@media (prefers-reduced-motion: reduce)` guard as a second belt.
- **Reduced motion is now disclosed, not silent (Q3).** The owner's first phone session likely ran
  with battery-saver forcing `prefers-reduced-motion`, so he may never have seen the feel layer and
  nothing told him. Two disclosures: the dev HUD's reduced-motion line becomes an unmissable filled-red
  banner when ON, and the in-game pause sheet carries one quiet permanent footer line ("Reduced motion
  is on — your device or browser requested it.") — discoverable truth, not a nag or toast.
- **SETS_TO_WIN stays an intentional literal (Q5).** Re-checked under the freeze: the engine has NO
  `SETS_TO_WIN` constant to re-export — the "3" is embedded in `sets.ts:hasThreeCompleteSets` as
  `>= 3`. Introducing a constant would edit frozen engine LOGIC (change the comparison + rename the
  predicate), which is not the "pure re-export" Q5 gated on. So the engine is left byte-identical and
  the Book's win count remains the clearly-commented local `SETS_TO_WIN = 3`, as PHONE-1 already ruled.
- **Lint is zero and gated; react-hooks reference removed, not installed (Q4).** The 7 errors were 6
  unused-var/empty-block hits in dev-only capture scripts (removed the dead code) plus a lone
  `eslint-disable react-hooks/exhaustive-deps` in `useDragController` referencing a plugin that was
  never installed. Under the "no new features / small pass" limit, installing the plugin would add a
  new dependency and surface pre-existing hook violations across the app (unbounded scope); so the
  honest fix is to remove the dead reference and replace it with a plain note. `pnpm verify` now runs
  `pnpm lint` first, so the count can never drift back up unnoticed.

## LANDSCAPE REBUILD (R) — owner landscape directive (2 Aug)

- **SAUDA is landscape-only, enforced by a rotate gate — the game never lays out in portrait.** A
  browser cannot force orientation outside fullscreen, so rather than lay the board out at the wrong
  aspect ratio, the App detects portrait (`orientationOf(w,h)`: `h > w`, a perfect square counts as
  landscape so a mid-rotation `w===h` tie can't flicker the gate) and renders `RotateGate` INSTEAD of
  the game. The game is UNMOUNTED, not merely covered: its state lives in the zustand store, so no bot
  steps behind the gate (the bot timers live in Table's effects, which are gone), and rotating back to
  landscape remounts and resumes exactly. This is the most defensible reading of "over a paused, hidden
  game / never lays out in portrait." The pure dev ART routes (`#/dev/card`, `/plates`, `/wheel`) stay
  ungated — they are review tools shot in a tall box, not the game.
- **Fullscreen + orientation lock is a best-effort convenience, never a requirement.** The gate offers
  one "Go fullscreen" control: from that user gesture it calls `requestFullscreen()` then
  `screen.orientation.lock('landscape')`, each wrapped and failure-tolerant. On a browser that refuses
  either (desktop Safari, an in-app webview) the player just rotates by hand and the gate clears — the
  game never depends on the lock succeeding.
- **The M5 Capacitor build locks landscape NATIVELY, so the web gate is a web-only fallback.** The
  native Android manifest pins `android:screenOrientation="landscape"` (Capacitor
  `orientation: 'landscape'`), so the packaged app can never be portrait and the rotate gate is dead
  code there. The gate exists only for the web build, where the platform gives us no manifest.
- **The device testbed rotated to landscape.** `deviceProfiles.json` now holds the four PHONE-1
  Android sizes with width/height swapped (740x360, 800x360, 832x384, 915x412) plus a 915x412
  reduced-motion variant. The binding constraint flips from height (portrait) to the SHORT edge (360px
  tall); `legacy-740x360` is the tightest budget and stays the default single-still smoke subject.

### R1 — Layout v3, focus follows turn (2 Aug)

- **The play screen is now two states, chosen by whose turn it is (focus follows turn).** MY TURN
  renders my world only — a far-edge bot rail, a top row of my sets · play stage · controls
  (bank/Munshi/turn token), and the hand wheel spanning the full bottom width (hub bottom-centre).
  SPECTATE (any bot's turn) splits the screen: the acting bot's panel (the larger share, their card
  spotlit) and my panel (my sets + bank + hand as backs). Zone maths are pure + unit-tested
  (`landscapeLayout.ts`); Board keeps all interaction glue and delegates only the composition to
  `MyTurnLayout` / `SpectateLayout`.
- **The wheel spans the full content width, so its arc is far wider than the old ~344px my-area** —
  the "bigger, clearer roulette" the owner asked for. The no-clip invariant suite now also runs at the
  landscape wheel-container widths (694/754/786/869), so containment is proven at the wider arcs.
- **The old slim table band (draw-pile count · turn text · discard top) is dropped from the play
  area.** The draw is automatic (L4), so the pile was display-only; the turn state now reads on the
  turn token and the "You"/bot headers. The draw/discard counts can be reintroduced in a corner if the
  owner wants them — flagged, not silently lost.

### R3 — Bank inspect (2 Aug)

- **Opponent bank composition is PUBLIC — no engine change needed (audit).** `OpponentView.bank:
  CardId[]` is exposed by `observe.ts` (interface line 35, populated line 81: `bank: [...player.bank]`),
  so the UI may show an opponent's banked cards as real faces. Tapping my bank tray opens a bank grid
  (BankView); an opponent's bank shows the same way inside their board zoom (a bank row added to
  TableView). The frozen engine was not touched.
- **The bot rail is capped by the in-game home/pause glyph.** The ⌂ glyph is fixed at the top-left,
  over the rail; the rail now pads its top so the first bot chip starts beneath it — the glyph reads as
  the rail's cap. (Caught in a landscape capture where a chip tap opened the pause sheet instead.)

### R4 — Payment freedom (2 Aug)

- **Roster audit: the roster was already COMPLETE; the bug was CLASSIFICATION.** `paymentDetails`
  builds the payable list from every `myBank` card (banked actions live there) + every table property
  + building, minus ANY wildcards (worth ₹0). Banked actions WERE in the roster — but `isMoney =
  kind==='money'` bucketed a banked action as a "property", so it hid behind the "Pay with property
  instead" expander and the default (money-first) rarely picked it. That is why the owner "could not
  pick banked action cards." Fix: `PayableCard.fromBank` (a bank card = money OR banked action, always
  shown; a table property = the only thing the expander hides). The never-break-sets default now
  spends bank cards freely and only penalises spending TABLE properties. The engine is untouched.
- **Strategic overpay is a first-class move.** The sheet already allowed selecting past the debt; R4
  makes it obvious — "Choose differently" reveals every remaining payable card as a real face, the
  meter shows the excess with "no change given", and Pay submits the overpay. It is exactly as easy as
  the suggestion. ANY wildcards never appear (unit-tested).

### R5 — Targeting reference panel (2 Aug)

- **Targeting is a landscape split: targets (~60%) + a read-only MY SETS reference (~40%), default
  open, toggleable.** The reference renders my own board (`GroupRow`, no dropSets / no rearrange / no
  onExpand → nothing glows, nothing taps), so a target can be chosen strategically ("I hold 2 Jaipur;
  take their Jaipur"). It is reference-only and cannot change what is targetable — the target chips
  remain the only commit path (BAD_TARGET stays unreachable from the UI).

### R6 — Munshi portrait + nuanced advice (2 Aug)

- **Munshi PORTRAIT: already wired, file simply absent — drop it at
  `apps/mobile/src/assets/plates/munshi.webp`.** The medallion already calls `plateUrl('munshi')`
  (PHONE-2), which returns the image via the plate glob if present and null otherwise (→ the code-drawn
  bust silhouette fallback). There is no separate Gemini/plate-source folder in the repo — the plate
  sources ARE `apps/mobile/src/assets/plates/*.webp`. So the owner drops the lithograph there as
  `munshi.webp` (webp, ~600×870 like the other plates); it is picked up with zero code change, and
  `build-plate-variants.mjs` will generate its downscaled tiers. No munshi image exists anywhere in the
  repo today (searched), so the fallback silhouette is what renders until the file is dropped.
- **Advice is now COMPOSED in the UI layer from the recommendation + public facts (packages/bots
  byte-identical).** `composeMunshiAdvice(advice, observation)` writes the sentence from the bot's
  frozen `reason` PLUS a concrete PUBLIC fact — set progress ("that makes 3 of 3"), a visible rival
  threat ("Bot 2 is one card from a full Chennai"), the actual threat, a card value, or plays left.
  Rule (unit-tested per reason with fact injection): every line names the move and cites ≥1 concrete
  fact, and NEVER reads hidden info (opponent hands, deck order). `consultMunshi` now returns the
  observation alongside the advice so the card can compose. Before: "Make this play — it is the
  soundest move on the board…"; after: "Play Makaan — the soundest move on the board, and you have 2
  plays left this turn."

### R7 — Shell in landscape (2 Aug)

- **Home and the Book are now two-pane in landscape.** Home: the SAUDA wordmark + tagline + first-run
  ribbon on one side, the three doors (KHELO / VS FRIENDS / NIYAM) on the other — the old single
  vertical column would overflow a 360px-tall screen. The Book: a persistent contents rail on the left
  (with the active chapter highlighted) and the chapter on the right — replacing the old toggle between
  a contents page and a chapter, so the reader always sees where they are. First-run ribbon and every
  dismiss pattern (✕ / backdrop tap) are unchanged. The pause sheet is a small centred card that
  already reads correctly in landscape (its reduced-motion disclosure line is kept).

## LANDSCAPE-2 — verify, prove, clean (3 Aug)

### L1 — the green gate is now a wall, not a convention

- **`pnpm gate` is the canonical pre-commit gate.** It runs, in order: `gate:ip` (the ip-guard test
  alone, ~1s) → `pnpm -r typecheck` → `pnpm lint` → `pnpm -r test` (the full 418-test suite, which
  includes the ip-guard again). The ip-guard runs FIRST and fast so the exact failure class that caused
  the R slip is caught in ~1s, before the slower checks even start. `pnpm run verify` is kept as an
  alias-of-habit; `gate` is the name the hook and DECISIONS refer to.
- **A versioned pre-commit hook makes a red commit impossible.** `.githooks/pre-commit` runs `pnpm gate`
  and blocks the commit on any failure; `git config core.hooksPath .githooks` activates it (so the hook
  is tracked in-repo and travels with the branch, unlike `.git/hooks/*`). Chosen over husky because it
  needs no dependency and no `prepare` script — lightest thing that is also version-controlled. Escape
  hatch is the standard `git commit --no-verify`, to be used only deliberately.
- **History note — R2–R5 were committed engine-red; not rewritten.** The whole-repo ip-guard (§2) fails
  on ANY file, and a code comment in `apps/mobile/src/game/labels.ts` used a two-word phrase (a common
  English way of saying "a brief bit of copy") that happens to collide with one of the banned railroad
  names. (This DECISIONS entry deliberately does NOT quote that phrase — doing so is exactly what tripped
  the guard on EXPLAIN.md at `315d26f`, and would trip it here too.) It was introduced at R2 and present
  through R5, so the ip-guard test was RED on commits `50f5465` (R2), `103ca2e` (R3), `8039421` (R4),
  `f81cfc7` (R5); it was reworded at R6 (`79d94da`) and the tree has scanned clean since.
  **These four commits are NOT rewritten** — the R branch is shared (the owner pulls it onto a phone
  over the tunnel) and rebasing a published line is riskier than the original slip. They are instead
  **retroactively confirmed green at HEAD** (full gate output pasted in the LANDSCAPE-2 report), and the
  hook above prevents any recurrence. One residual banned literal survives in **git history only**:
  R6's commit message (`79d94da`) quotes the phrase while describing the fix. The ip-guard scans the
  working tree, not commit messages, so this does not fail the gate; it is left in place for the same
  do-not-rewrite-shared-history reason. Working tree at HEAD is fully clean.

### L4 — the table band is a gauge, not a target

- **The restored draw/discard readout is NON-INTERACTIVE by design.** Auto-draw (L1, PHONE era) made the
  piles display-only; a draw is never a tap. So `TableBand` renders `pointer-events: none` on the low
  `LAYERS.board` tier, absolutely positioned (zero layout footprint, so it can never induce a page
  scroll), pinned in a stage corner each layout leaves free — top-right of the centre stage in MY-TURN,
  bottom-right of the acting stage in SPECTATE. It shows a face-down draw stack + count and the discard
  top (a dashed empty slot when the discard is empty, e.g. turn 1). It is a gauge you read, not a zone
  you act on.

### L3 — the never-looked-at profiles pass

- **compact-800x360 / mid-832x384 / reduced-915x412 were eyeballed and all pass.** No overlap, clipping,
  void, or collided turn-token/tray/wheel. The one observation: with a many-target action (HAATH KI
  SAFAI) the lowest target chips sit near the dimmed hand fan on the shorter profiles — but the targeting
  overlay is a full `LAYERS.surface` scrim above the wheel, so the chips are correctly layered on top and
  stay readable. This is the same layered look the approved R5 single-target still shows, so it is left as
  designed (locked-visuals limit); no code change was warranted.

### L6 — reduced motion, the shell, and the tunnel

- **Reduced motion is a first-class, on-device-visible state.** `?hud=1` prints `reduced-motion: ON` as an
  unmissable filled-red banner (PHONE-2 Q3) so the owner can SEE on the phone whether battery-saver forced
  it — the thing he could not see on his first phone game. The reduced-motion landscape variant
  (`reduced-915x412`) is now a captured, audited profile (L3), and `FocusTransition` / every K-tier
  animation collapses to an instant cut under it. Nothing about comprehension depends on motion.
- **The orientation shell is verified, not assumed.** Portrait raises the rotate interstitial (the game
  stays unmounted, never laid out at the wrong aspect); landscape enters the game directly; the one "Go
  fullscreen" affordance calls `requestFullscreen` then `screen.orientation.lock('landscape')`, each in
  its own try/catch so a browser that refuses either just falls back to a by-hand rotate. All four
  behaviours are asserted by the L6 capture stage (instrumented spies prove the lock is called AND that
  its rejection is swallowed).
- **The Cloudflare quick tunnel is ephemeral — treat a dead one as dead.** The tunnel the owner had been
  using had accumulated ~1300 edge registration failures and served a browser error page. A dead tunnel
  helps no one, so LANDSCAPE-2 restarted it (`cloudflared tunnel --url http://localhost:5174`), yielding a
  fresh URL that was confirmed live in a real browser (Home 200 + the /#/autostart game). Quick-tunnel
  URLs rotate on restart; the current one is printed in the pass report, not hard-coded anywhere.

## LANDSCAPE-3 — Munshi portrait + final polish

- **The Munshi portrait is a normal plate, composed to the 100:145 card canvas (not a raw square).**
  The owner's lithograph is a square (2048×2048) circular bust; every plate — and the always-on
  `plates.test.ts` net — requires the 600×870 card ratio ≤150 KB. So the derived `munshi.webp` scales the
  square to the 600 width and CENTRES it on a white 600×870 canvas (the litho's own outer margin is pure
  white, so the pad is seamless) — the whole drawing is preserved, nothing cropped or repainted (§ "the
  lithograph stays as the owner made it"). `munshi` is never drawn as a full card (only the round
  medallion in `MunshiChip` references it), so the pad is never visible in-game. Source stays in
  Downloads; only the derived webp entered the repo. Conversion followed the repo's only plate setting
  (`webp quality 82`, resize-by-width) from `build-plate-variants.mjs`.
- **The circular framing is a CSS-only mask on the medallion slot, not an image edit.** The 46 px round
  medallion frames just the face: `object-position: 50% 20%` biases the crop up to the turban/face (the
  litho's vertical centre is the hands/ledger) and `transform: scale(1.32)` pushes the litho's own cameo
  ring past the slot edge so the bust fills the circle. Reduced-motion still parks the float; the mask is
  independent of the animation (float is on the slot div, the mask on the child `<img>`).
- **The targeting overlay parks the hand fully, rather than reserving a band above it (M2 close-out).**
  On the shortest 740×360 profile the many-target chip cluster grazed the dimmed hand fan bleeding
  through the 35% scrim (LANDSCAPE-2 flag 3). A reserved band can't fit the tall content — the hand band
  is ~166 px of a 360 px height, leaving too little for the 88 px card + wrapped chips. So the hand (a
  sleeping, already-non-interactive modal background during targeting) is parked fully: `handAsleep`
  drops the wheel band to opacity 0 + pointer-events none, keeping its height (no reflow). Targetability
  is untouched (still purely `legalActions`); the My-Sets reference panel is unchanged.
