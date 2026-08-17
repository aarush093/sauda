# SAUDA — Build Specification

> **How to use:** Create an empty git repo and work through this specification milestone by milestone. Do not skip the acceptance criteria.

---

## 1. Mission

Build **SAUDA** (सौदा) — a fast-paced, offline-first property card game for Android (and web), where 2–4 players race to complete **3 full property sets of different colors**. Single human player vs AI bots, plus local pass-and-play. Premium desi pop-art visual identity. Shipped as a signed Android App Bundle via Capacitor, with a web build deployable to Vercel.

The game mechanics belong to a well-known public card-game genre (set collection + take-that). We are building an **original expression** of those mechanics: original name, original card names, original artwork (all SVG, generated in code), original rule text written from scratch.

## 2. Hard IP guardrails (non-negotiable)

- The strings `Monopoly`, `Hasbro`, `Parker Brothers`, `Mr. Monopoly`, `Boardwalk`, `Park Place`, or any Atlantic City street name from the classic board game must **never** appear anywhere: code, comments, tests, assets, commit messages, store listing, README.
- Do not copy rule-book sentences from any published game. All in-game help text, card text, and tutorial copy must be written fresh for this project (Hinglish flavor welcome).
- No use of the stylized "M with double bar" currency mark. Our currency is **₹ Cr** (crores).
- No top-hat mascot, no imitation of any existing card layout/trade dress. Card faces are original SVG compositions defined in this spec.
- All theme strings (game name, set names, card names, flavor text) live in **one file**: `packages/engine/src/theme.ts`. A rebrand must be possible by editing that single file.

## 3. Product identity

- **Name:** SAUDA — tagline: *"Deal karo. Kabza karo. Jeeto."* (Alternates if needed later: "Kabza", "Property Panga" — but build with SAUDA.)
- **Elevator pitch:** A 10–15 minute cutthroat property card game set across iconic Indian streets. Collect, charge kiraya, steal sets, and slam the Kabza stamp.
- **Platforms:** Android (primary, Capacitor), Web (same build, instant share link). iOS later.
- **v1 modes:** Solo vs 1–3 bots (Easy/Medium/Hard), Pass-and-play (2–4 humans, one device).
- **No accounts, no backend, no ads, no data collection in v1.** Fully offline.

## 4. Complete rules specification (original wording — implement exactly)

### 4.1 Objective
First player to own **3 complete property sets in 3 different colors** wins. A win may only be **declared on your own turn** (the engine detects completion at any time, but the victory event fires at the start of, or during, the winner's own turn).

### 4.2 Setup
- Shuffle the 106-card deck (see §6). Deal 5 cards to each player, face down. Remaining cards form the **draw pile**. A shared **discard pile** (center) starts empty.
- Random starting player; play proceeds clockwise.

### 4.3 Zones
Each player has: **Hand** (secret), **Bank** (face-up money pile), **Property area** (face-up cards arranged in color groups). Shared: **draw pile**, **discard pile**.

### 4.4 Turn structure
1. **Win check:** if you already hold 3 complete different-color sets, you win now.
2. **Draw:** draw 2 cards. If your hand is empty at the start of your turn, draw 5 instead. (No mid-turn refill.)
3. **Plays:** make up to **3 plays**, in any combination:
   - **Bank a card** — put any money card *or any action card* into your bank at its ₹ value. An action card banked as money can never be used for its action again.
   - **Place a property** — put a property or wildcard into your property area, choosing its color group.
   - **Play an action card** — resolve its effect (see §5), then the card goes to the discard pile.
   - You may play 0 plays if you wish.
   - **Free (not a play):** rearranging your own wildcards between your color groups, any number of times, but only on your own turn.
   - **Never a play:** NAHI CHALEGA (see §5) — it can be played at any time, even off-turn, and never consumes a play.
4. **Discard:** if you hold more than 7 cards, discard down to 7. Overflow discards go **face-down to the bottom of the draw pile** (owner house rule, in the order discarded) — not to the discard pile, so they recycle into future draws. Turn ends.

### 4.5 Payments (the heart of the game — implement precisely)
- You may **only pay with cards on the table** (bank and/or property area). Cards can never move from any hand to pay, and paid cards never enter any hand.
- The **payer chooses** which cards to hand over.
- **No change is given.** Overpaying is allowed and sometimes forced (e.g., owe ₹2, only have a ₹5 card → pay ₹5, lose ₹3).
- If the payer's total table value is **less than** the amount owed, they pay **everything payable on their table** and the debt is settled. If they have nothing on the table, they pay nothing.
- **Multi-color ANY wildcards have ₹0 value and can never be used as payment.**
- Money and action cards paid go to the receiver's **bank**. Property cards paid go to the receiver's **property area** (receiver chooses group for received wildcards).
- Paying with property is allowed even if it breaks the payer's own complete set.
- If a complete set becomes incomplete and it had a MAKAAN/HAVELI, those buildings automatically move to their owner's bank at face value (configurable, see §7).

### 4.6 Draw pile exhaustion
When the draw pile empties, shuffle the discard pile to form a new draw pile.

## 5. Action cards (effects — original text; write your own in-game copy)

| Card | ₹ value | Effect |
|---|---|---|
| **KABZA** (×2) | 5 | Take one opponent's **complete** set, including any MAKAAN/HAVELI on it. |
| **HAATH KI SAFAI** (×3) | 3 | Take any single property card from an opponent — but never from a complete set. |
| **ADLA-BADLI** (×3) | 3 | Swap one of your property cards with one of an opponent's. Neither card may be part of a complete set. |
| **NAHI CHALEGA!** (×3) | 4 | Cancel any action card played against you, at any moment, even off-turn. Can itself be cancelled by another NAHI CHALEGA (chains allowed). Never consumes a play. |
| **VASOOLI** (×3) | 3 | Demand **₹5 Cr** from one chosen opponent. |
| **SHAGUN** (×3) | 2 | Every opponent pays you **₹2 Cr**. |
| **AAGE BADHO** (×10) | 1 | Draw 2 cards immediately. Multiple per turn allowed; each consumes a play. |
| **MAKAAN** (×3) | 3 | Place on one of your **complete** sets (never Junctions/Utilities). Adds **₹3 Cr** to that set's kiraya. Max one per set. |
| **HAVELI** (×2) | 4 | Place on a complete set that already has a MAKAAN. Adds **₹4 Cr** more. Max one per set. |
| **DUGNA!** (×2) | 1 | Play together with a KIRAYA charge to double it. Each DUGNA consumes one play. Stacking allowed up to config limit (default 2 → 4× kiraya using all 3 plays). |
| **KIRAYA duo** (×2 each of 5 pairs) | 1 | Choose one of the two colors on the card. **All opponents** pay you the current kiraya of your holdings in that color. You must own ≥1 property of the chosen color. |
| **KIRAYA WILD** (×3) | 3 | Choose **one opponent** and any color you own; they pay that kiraya. |

**Kiraya amount** = the rent value printed for the number of properties you own in that color (see §6), **plus ₹3 for MAKAAN and ₹4 for HAVELI if the set is complete**, then × DUGNA multipliers.

**Interrupt / response window:** VASOOLI, SHAGUN, KIRAYA (per target), KABZA, HAATH KI SAFAI, ADLA-BADLI each open a response window for the targeted player: play NAHI CHALEGA or comply. NAHI CHALEGA chains resolve last-in-first-out. For multi-target charges (SHAGUN, duo KIRAYA), each target resolves independently — one player's NAHI CHALEGA only protects that player.

## 6. Full deck data (106 cards) — put this in `packages/engine/src/theme.ts` + `deck.ts`

Currency: ₹ Cr. `rent[i]` = kiraya when owning `i+1` properties of that color; last entry = full set.

### 6.1 Property sets (10 colors → Indian streets)

```ts
export const SETS = {
  puraniDilli: { label: "Purani Dilli", hex: "#8C4A2F", icon: "jalebi",   size: 2, value: 1, rent: [1, 2] },
  kashi:       { label: "Kashi Ghats",  hex: "#2FA8C9", icon: "diya",     size: 3, value: 1, rent: [1, 2, 3] },
  jaipur:      { label: "Jaipur",       hex: "#D6337A", icon: "jharokha", size: 3, value: 2, rent: [1, 2, 4] },
  kolkata:     { label: "Kolkata",      hex: "#E8842C", icon: "tram",     size: 3, value: 2, rent: [1, 3, 5] },
  chennai:     { label: "Chennai",      hex: "#C6342B", icon: "filterCoffee", size: 3, value: 3, rent: [2, 3, 6] },
  bangalore:   { label: "Bangalore",    hex: "#E3B505", icon: "circuit",  size: 3, value: 3, rent: [2, 4, 6] },
  newDelhi:    { label: "New Delhi",    hex: "#1E7A46", icon: "pillar",   size: 3, value: 4, rent: [2, 4, 7] },
  mumbai:      { label: "Mumbai",       hex: "#1D3F8F", icon: "wave",     size: 2, value: 4, rent: [3, 8] },
  junction:    { label: "Junctions",    hex: "#22222A", icon: "train",    size: 4, value: 2, rent: [1, 2, 3, 4] },
  utility:     { label: "Utilities",    hex: "#7C8A6E", icon: "bulb",     size: 2, value: 2, rent: [1, 2] },
} as const;

export const PROPERTIES = [
  ["puraniDilli", ["Chandni Chowk", "Chawri Bazaar"]],
  ["kashi",       ["Assi Ghat", "Tulsi Ghat", "Dashashwamedh Ghat"]],
  ["jaipur",      ["Hawa Mahal Road", "Johari Bazaar", "MI Road"]],
  ["kolkata",     ["Park Street", "College Street", "Ballygunge"]],
  ["chennai",     ["T. Nagar", "Anna Salai", "Besant Nagar"]],
  ["bangalore",   ["MG Road", "Indiranagar", "Koramangala"]],
  ["newDelhi",    ["Connaught Place", "Khan Market", "Lodhi Road"]],
  ["mumbai",      ["Marine Drive", "Altamount Road"]],
  ["junction",    ["Howrah Junction", "Mumbai CST", "New Delhi Station", "Chennai Central"]],
  ["utility",     ["Bijli Ghar", "Jal Board"]],
] as const; // 28 cards
```

### 6.2 Property wildcards (11)

```ts
export const WILDCARDS = [
  { colors: ["jaipur", "kolkata"],   value: 2, count: 2 },
  { colors: ["chennai", "bangalore"],value: 3, count: 2 },
  { colors: ["kashi", "puraniDilli"],value: 1, count: 1 },
  { colors: ["kashi", "junction"],   value: 4, count: 1 },
  { colors: ["mumbai", "newDelhi"],  value: 4, count: 1 },
  { colors: ["newDelhi", "junction"],value: 4, count: 1 },
  { colors: ["junction", "utility"], value: 2, count: 1 },
  { colors: "ANY",                   value: 0, count: 2 }, // never payable, no value
];
```

### 6.3 Action cards (34) — counts/values as in §5.

### 6.4 KIRAYA cards (13)

```ts
export const KIRAYA = [
  { colors: ["puraniDilli", "kashi"], value: 1, count: 2 },
  { colors: ["jaipur", "kolkata"],    value: 1, count: 2 },
  { colors: ["chennai", "bangalore"], value: 1, count: 2 },
  { colors: ["newDelhi", "mumbai"],   value: 1, count: 2 },
  { colors: ["junction", "utility"],  value: 1, count: 2 },
  { colors: "ANY", targeted: true,    value: 3, count: 3 },
];
```

### 6.5 Money (20 cards, ₹57 Cr total)
`6×₹1, 5×₹2, 3×₹3, 3×₹4, 2×₹5, 1×₹10`

**Total: 28 + 11 + 34 + 13 + 20 = 106. Write a test asserting exactly this composition and total money value 57.**

## 7. Rule config (engine-level toggles, surfaced in Settings)

```ts
export const DEFAULT_RULES = {
  players: { min: 2, max: 4 },
  handLimit: 7,
  playsPerTurn: 3,
  drawPerTurn: 2,
  emptyHandDraw: 5,
  maxDugnaPerCharge: 2,        // 1 = classic-strict
  buildingsStackRent: true,     // MAKAAN +3 and HAVELI +4 both count
  orphanedBuildings: "toBank", // "toBank" | "stay"
  winDeclaredOnOwnTurnOnly: true,
} as const;
```

## 8. Architecture

**Monorepo (pnpm workspaces), TypeScript strict everywhere.** Python appears only in `ml/` (training). One source of truth for rules: the TS engine. The client runs the engine locally → the game is fully offline. (A future online mode would run the same engine on a Node server; do NOT build any server in v1.)

```
sauda/
├─ packages/
│  ├─ engine/        # pure TS rules engine, zero deps beyond zod. Deterministic, seeded RNG.
│  │  ├─ src/{theme,deck,state,actions,reduce,legal,invariants}.ts
│  │  └─ fixtures/   # JSON scenario fixtures exported by tests (for Python parity)
│  └─ bots/          # RandomBot, HeuristicBot (v1), IsmctsBot (M6), OnnxBot adapter (M6)
├─ apps/
│  └─ mobile/        # React 18 + Vite + TS + Capacitor. zustand, framer-motion, howler.
├─ ml/               # Python 3.11: gymnasium env (rules port), MaskablePPO self-play, ONNX export
├─ tools/            # CLI playtest, 1000-game simulator, fixture generator, screenshot script
└─ store/            # listing copy, privacy.html, feature-graphic.svg, icons
```

### 8.1 Engine spec
- **Event-sourced state machine.** `reduce(state, action) → Result<{state, events[]}>`. Every mutation flows through `reduce`. Full `GameEvent[]` log enables replay, debugging, and ML trajectory extraction.
- **`legalActions(state, playerId): Action[]`** must be exhaustive and exact — the UI renders only legal moves, and bots choose only from this list. If `legalActions` is right, illegal states are unrepresentable.
- **Interrupt stack** for response windows (NAHI CHALEGA chains, payment selection). Turn cannot advance while the stack is non-empty.
- **Hidden information respected:** expose `observe(state, playerId)` returning only what that player may see (own hand, all public zones, opponents' hand *counts*). Bots and UI consume observations, never raw state.
- Seeded RNG (mulberry32) — same seed ⇒ same game. No `Math.random` anywhere in engine.

### 8.2 Engine testing (this is the project's spine — do not shortcut)
- Unit tests for **every** rule in §4–§5, including all of these named edge cases:
  1. Overpay with no change; 2. partial payment when table < debt; 3. zero table → no payment; 4. ANY-wildcard never payable and never counted in "can pay" checks; 5. paying with a card that breaks your own complete set (+ building relocation); 6. HAATH KI SAFAI / ADLA-BADLI blocked against complete sets; 7. KABZA transfers buildings; 8. NAHI CHALEGA chains of depth 3; 9. NAHI CHALEGA never consumes a play, works off-turn; 10. SHAGUN with mixed responses (one opponent cancels, others pay); 11. DUGNA stacking to config limit and play-count accounting; 12. kiraya requires ownership of the chosen color; 13. building rent bonus only when set complete; 14. empty-hand draw-5 only at turn start; 15. discard-to-7 enforcement; 16. draw-pile reshuffle from discard; 17. wildcard rearrangement free and own-turn only; 18. win detected off-turn but declared only on own turn; 19. received wildcard group choice by receiver; 20. deck composition = 106 / ₹57 Cr money.
- **Property-based invariant tests** (fast-check), run over thousands of random bot games: total cards across all zones always 106; hand ≤ handLimit after every turn end; playsUsed ≤ 3; interrupt stack empty at turn boundaries; no card ever returns to any hand; game terminates < 500 turns.
- Export ~30 curated **fixtures** (`initialState`, `actions[]`, assertions) to `packages/engine/fixtures/*.json` — the Python env must pass these identically (M6 parity gate).

### 8.3 Bots
- Common interface: `chooseAction(observation, legalActions, rng): Action`.
- **HeuristicBot** (v1, three difficulties) — implement this documented strategy, don't improvise silently:
  1. If a placement completes the 3rd set → do it and declare.
  2. Early game: bank until liquid ≥ ₹5, then prioritize property placement toward the two cheapest-to-complete sets.
  3. Charge cards: play when expected collectible value ≥ card's bank value (estimate from opponents' visible tables).
  4. KABZA the opponent set that most advances *their* win; never waste it on a 2-value set if a bigger threat exists.
  5. Hold NAHI CHALEGA for threats ≥ ₹4 expected loss (Hard), spend freely (Easy).
  6. Payment selection: minimize damage — bank low-overpay first, then properties from the largest incomplete surplus, never break a complete set unless forced.
  7. Hard only: track discard pile + played cards to estimate remaining NAHI CHALEGA / KABZA in circulation.
- Simulator target (M2 gate): over 1,000 seeded games, HeuristicBot(Medium) beats RandomBot ≥ 90%; average game ≤ 25 turns; zero invariant violations.

### 8.4 Munshi (in-game advisor)
- An **offline, read-only** advisor (vintage-clerk framing, "Munshi"). **3 uses per game, flat** — no ads, purchases, earn-loops, or carry-over between games (no FOMO mechanics, project law).
- Available at any decision the human owns (their turn, the payment sheet, an interrupt window they answer). One use = evaluate the current legal options → highlight the recommended one (the existing gold legal-action glow) + one short templated line of reasoning. Advisory only; the highlight clears on the next action.
- **Shares the HeuristicBot brain:** the ranking cascade is extracted into a single `recommend(observation, legalActions, difficulty)` that both the bot and Munshi consume, so they can never disagree. Reasoning lines are a small template set keyed by *why* the top move ranked first (completes / denies / protects a set · best value · preserves a counter). No free-form generation, no LLM — fully offline and deterministic (same state → same recommendation). Structurally read-only: it consumes an observation + `legalActions` and returns a recommendation; it has no access to `reduce` or `GameState`.
- Ships as `@sauda/bots` `Munshi` (module + unit tests); UI wiring is M4b.

## 9. ML pipeline (`ml/`, milestone M6 — build only after M5 ships)

Goal: a learned "Boss" difficulty, trained by self-play, running **on-device**.

1. **Python env:** `SaudaEnv` (Gymnasium). Port the rules; prove parity by replaying every JSON fixture from `packages/engine/fixtures/` bit-for-bit (CI job).
2. **Encoding:** observation = fixed vector (own hand as 106-multi-hot collapsed to card-type counts; per-player public zone counts/values; set completion progress; turn/plays context). Action space = flat enumeration of a canonical action grammar with an **action mask** built from `legal_actions`.
3. **Training:** `sb3-contrib` MaskablePPO, self-play against a frozen opponent pool (past checkpoints + a Python port of HeuristicBot). Log winrate curves.
4. **Gates:** ≥95% vs Random, ≥55% vs HeuristicBot(Hard) over 2,000 games.
5. **Export:** ONNX policy → `apps/mobile` runs it with `onnxruntime-web`; identical obs encoder implemented in TS (share the encoder spec as JSON, test with golden vectors). Fallback to HeuristicBot if the model fails to load.

## 10. UI / UX + design direction

Read this as the design brief; make deliberate choices, not template defaults.

- **Aesthetic:** desi pop — vintage Indian **matchbox-label / truck-art** energy. Bold two-tone woodcut-style set icons, hand-painted border motifs, paper-textured card faces. Confident and playful, never corporate-flat, never casino-green.
- **Tokens:** table background deep indigo `#171B4A` with a subtle phool-patti painted border frame; card paper `#F6EFDF`; ink `#1C1A17`; per-set hexes from §6.1; danger stamp red `#C6342B`; gold foil accent `#D9A441` used *only* for money and the win moment.
- **Type:** display **Baloo 2** (chunky, Devanagari-capable — render "सौदा" in the logo lockup), body **Karla**, numerals/money **IBM Plex Mono**. Set a real type scale; no default system-font look.
- **Signature element (the one memorable thing):** the **rubber-stamp slam**. KABZA, VASOOLI and win moments resolve with a skewed ink-stamp animation (scale-down spring + haptic thud + paper shake), like a government office stamp. Spend the boldness here; keep everything else quiet and disciplined.
- **Cards are code, not images:** a single `<CardFace card={...}/>` React component renders every card as SVG from deck data (tiny APK, crisp at any size, rebrand = theme file). Each set shows its **icon glyph + label**, never color alone (colorblind-safe).
- **Screens:** Home → New Game (players/difficulty/rules toggles) → Table → Hand-off overlay (pass-and-play privacy screen between turns) → interactive Tutorial (scripted first game) → Settings → Stats → Rules reference.
- **Table layout (portrait):** opponents as compact fans on top (hand count, bank total, set progress pips); center draw + discard; your sets as horizontal group shelf; your hand as a bottom dock fan; bank as a chip stack bottom-left.
- **Interactions:** tap a hand card → bottom sheet listing only its legal plays ("Bank ₹3" / "Place in Jaipur" / "Play VASOOLI on…"); drag-to-zone as a power shortcut; long-press to zoom any card; NAHI CHALEGA prompt appears as an interrupt sheet with a 10s auto-resolve timer vs bots.
- **Motion:** spring-based card flights (framer-motion), staggered deal at game start, confetti burst on set completion, screen-shake ≤ 4px on stamp. Respect `prefers-reduced-motion`. 60fps on a mid-range phone.
- **Sound/haptics (howler + Capacitor Haptics):** card slide, stamp thud, coin clink, soft "nahi!" sting on cancel. All CC0/generated; a mute toggle in Settings.
- **Quality floor:** 44px minimum tap targets, works fully offline, safe-area insets, state survives app kill mid-game (persist via Capacitor Preferences), English UI copy with light Hinglish flavor, one consistent verb per concept ("Bank", "Place", "Play", "Pay").

## 11. Milestones — work strictly in order, tests green before advancing

- **M0 — Scaffold:** pnpm workspaces, TS strict, ESLint+Prettier, vitest, CI script (`pnpm -r typecheck && pnpm -r test`). Engine types, theme.ts, deck builder + composition test.
- **M1 — Engine complete:** everything in §4–§8.2. All 20 named edge cases covered; property tests pass; fixtures exported. *Gate: `pnpm -r test` green, coverage report shown.*
- **M2 — Bots + CLI:** RandomBot, HeuristicBot; `pnpm play` terminal game (human vs 3 bots, readable table render); `pnpm simulate --games 1000` stats harness. *Gate: simulator targets in §8.3 met; you play one full CLI game and paste the log summary.*
- **M3 — Mobile core:** full playable Table screen vs bots + pass-and-play with hand-off overlay. Every interaction driven by `legalActions`. *Gate: complete game start→win on web build with zero console errors.*
- **M4 — Polish:** tutorial, sound/haptics, animations incl. stamp signature, settings + rule toggles, stats persistence, app icon + splash, reduced-motion path. *Gate: Lighthouse perf ≥ 90 on web build; a friend can learn the game from the tutorial alone.* *(U3, first-player pass: the guided tutorial "Sikho" now ships — a deterministic, engine-legal demo game teaching every move and tying each to the Book; auto-offered once, permanent on Home. Lighthouse run still outstanding.)*
- **M5 — Ship:** Capacitor Android project, keystore + signed **AAB**, versionCode/versionName scheme, `store/` assets (feature graphic 1024×500, 6 screenshots via emulator script, listing copy), `privacy.html` (truthful: no data collected) ready for Vercel, Play data-safety answers drafted. Check and target the **current Play target-SDK requirement** at build time. *Gate: AAB builds reproducibly; `store/CHECKLIST.md` complete.*
- **M6 (optional, only after M5):** IsmctsBot (500ms budget, determinized rollouts) → then the full §9 ML pipeline → "Boss" difficulty behind a flag.

## 12. Operating instructions

1. At each milestone: plan briefly → implement → run typecheck + tests → show results → short summary → wait/proceed.
2. Maintain `DECISIONS.md` (every rules interpretation or deviation, one line each) and `PLAYTEST.md` (issues found while self-testing).
3. Never weaken a test to pass it. Never introduce `Math.random` into the engine. Keep components < 300 lines; extract.
4. If a rule in this spec seems ambiguous, implement the most defensible reading, note it in `DECISIONS.md`, and keep it behind `DEFAULT_RULES` if it's a genuine variant.
5. Commit per milestone with conventional messages (`feat(engine): …`).
6. Re-read §2 before writing any user-facing string.

## 13. Explicitly out of scope for v1
Online multiplayer, accounts/auth, any backend or database, ads/IAP, analytics SDKs, iOS build, localization beyond English-with-Hinglish. Do not add these even if convenient.

## 14. Landscape rebuild (R) — spec amendment (owner landscape directive, 2 Aug)

SAUDA is a **landscape-only** game with a **focus-follows-turn** screen model. This amendment supersedes
the portrait play-screen layout (§10) for the play surface; the engine, bots, card art, palette and rules
(§1–§9) are unchanged.

**Orientation.** The play screen only ever lays out with the long edge horizontal. A browser cannot force
orientation outside fullscreen, so in portrait the app renders a full-screen rotate interstitial over an
**unmounted, paused** game (state persists in the store; no bot steps behind it) — the game never lays out
in portrait. A "Go fullscreen" control best-effort enters fullscreen and `screen.orientation.lock('landscape')`.
The M5 Capacitor build pins landscape in the native manifest, so the gate is a web-only fallback. The device
testbed is the four PHONE-1 Android sizes rotated: 740×360, 800×360, 832×384, 915×412, plus a reduced-motion
variant; the binding constraint is now the **short edge (360px tall)**.

**The three screen states.**

- **A — MY TURN (my world only).** A far-edge bot **rail** (chips: seat · bank · set count · FULL badge ·
  gold ring on the active player; tap opens that bot's zoom), then a top row of three columns — my **sets**
  (left), the play **stage** (centre, the action drop target + the just-played spotlight), and my **controls**
  (right: bank tray · Munshi · turn token) — with the hand **wheel** spanning the full bottom width, hub at
  bottom-centre. The wheel is its own bottom row, so the bank tray and turn token never collide with it at any
  hand count. Zone maths: `resolveMyTurn(w, h)` — rail 46; two side columns clamp to [128, 200] at ~20% of the
  content width; the centre stage takes the rest (always the widest); the wheel band is clamp(0.46·h, [150, 178])
  and the top row is the remainder; the wheel container is the full width minus the rail. Bot boards do NOT
  render here.
- **B — SPECTATE (any bot's turn).** A split so I always see what is being done TO me: the acting bot's panel
  (the larger share) carries their name, their board, and the stage where each played card is held LARGE with
  its **caption** (§R2 below); my panel (the smaller share) keeps a read-only view of my sets, bank total and
  hand (as card backs — the wheel collapses; I can only act via interrupt overlays). Non-acting bots stay on
  the rail. Zone maths: `resolveSpectate(w, h)` — rail 46; the acting panel is max(300, 58% of content); my
  panel takes the rest (never wider than the acting panel).
- **C — OVERLAYS.** Payment, targeting, bank inspect, board zoom, the Book, the pause sheet and the rotate gate
  are each laid out for landscape (side-split or centred-wide), all on the LAYERS scale, all backdrop-tap + ✕
  dismissable, nothing clipped or scrolling the page (internal modal scroll stays legal).

**Transitions.** MY TURN ↔ SPECTATE is a single ~250ms slide + fade, transform-only, instant under reduced
motion, with no dead frame (the incoming layout dissolves in over the same felt).

**Amendment addenda (R2–R7).** R2: a bot's play reads as a **caption beside** the spotlit card ("B2 · Chennai
Central"), never behind it. R3: the bank is public — tapping my bank tray opens a real-face grid; an opponent's
bank shows the same way in their zoom. R4: payment offers every payable card (bank money, **banked actions**,
properties) with strategic overpay as easy as the suggestion. R5: targeting is a split with a read-only "My
Sets" reference (default open). R6: Munshi advice is composed from the recommendation + concrete public facts;
the portrait loads from `apps/mobile/src/assets/plates/munshi.webp` when present (silhouette fallback). R7: Home
and the Book are two-pane.
