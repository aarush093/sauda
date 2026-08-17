# SAUDA — Architecture

Diagrams derived directly from the code (`packages/engine`, `packages/difficulty`,
`apps/mobile`). Every phase, action and count below is read from the source, not
sketched from memory. Read [`../EXPLAIN.md`](../EXPLAIN.md) for the plain-English
narrative behind these shapes and [`../docs/STATUS.md`](STATUS.md) for what is
built today.

The one idea that unifies all six diagrams: **the engine is the only thing that
knows the rules.** It exposes two pure functions — `legalActions(state, player)`
(what may happen) and `reduce(state, action)` (what happens) — and everything else
(bots, difficulty tiers, the React UI) may only choose from, or render, what those
two functions already decided.

---

## 1. Monorepo dependency graph

Five workspaces. The arrows are real `package.json` dependencies. The **frozen
core** — `@sauda/engine` and `@sauda/bots` — is held byte-identical: the difficulty
wrapper and the whole UI only *sequence and render* what the core already produces,
so a rebrand or a UI change can never alter a rule or a bot decision.

```mermaid
graph TD
    subgraph frozen["🔒 Frozen core — byte-identical across UI/difficulty work"]
        engine["@sauda/engine<br/>pure rules · seeded RNG · zod<br/>legalActions() · reduce() · observe()"]
        bots["@sauda/bots<br/>RandomBot · HeuristicBot<br/>recommend()"]
    end

    difficulty["@sauda/difficulty<br/>DifficultyBot — degrades recommend() by tier"]
    mobile["apps/mobile<br/>React + Vite UI (the game you play)"]
    tools["tools<br/>CLI (pnpm play) · simulator · scenario fixtures"]

    bots --> engine
    difficulty --> bots
    difficulty --> engine
    mobile --> engine
    mobile --> bots
    mobile --> difficulty
    tools --> engine
    tools --> bots
    tools --> difficulty
```

`@sauda/engine` has **zero runtime dependencies beyond `zod`**. The dependency
arrows only ever point *toward* the engine — nothing the engine imports can know
about the UI, which is what keeps it a pure, testable core.

---

## 2. Game state machine (the engine's phases)

`TurnPhase` in [`packages/engine/src/state.ts`](../packages/engine/src/state.ts)
is exactly four states; the transitions are enforced in
[`reduce.ts`](../packages/engine/src/reduce.ts). A turn is draw → play up to three
times → (discard if over the hand limit) → next player.

```mermaid
stateDiagram-v2
    [*] --> awaitingDraw : game starts
    awaitingDraw --> playing : DRAW (2 cards, or 5 if hand empty)
    playing --> playing : BANK / PLACE_PROPERTY / PLAY_ACTION / PLAY_KIRAYA<br/>(each spends one of 3 plays) · REARRANGE_WILDCARD (free)
    playing --> awaitingDiscard : END_TURN with hand over the limit
    playing --> nextTurn : END_TURN within the hand limit
    awaitingDiscard --> awaitingDiscard : DISCARD (until at hand limit)
    awaitingDiscard --> nextTurn : hand at limit
    nextTurn --> awaitingDraw : next player's turn begins
    awaitingDraw --> gameOver : DECLARE_WIN (3 sets, 3 colours)
    playing --> gameOver : DECLARE_WIN (3 sets, 3 colours)
    gameOver --> [*]
```

### 2a. The interrupt window (a charge/steal freezes the turn)

A charge or steal is **not** applied immediately. It becomes a frame on
`pendingInterrupts` and opens a response window; while a frame is open, *only that
frame's `responder`* has any legal moves — which is how the turn freezes and how
**NAHI CHALEGA** can be played off-turn. The frame's own `InterruptStatus` is the
sub-state machine:

```mermaid
stateDiagram-v2
    [*] --> awaitingResponse : VASOOLI / SHAGUN / KABZA / HAATH KI SAFAI / ADLA-BADLI / LAGAAN played
    awaitingResponse --> awaitingResponse : RESPOND_NAHI_CHALEGA<br/>(adds to chain, flips responder)
    awaitingResponse --> cancelled : RESPOND_ALLOW & odd NAHI count (parity)
    awaitingResponse --> awaitingPayment : RESPOND_ALLOW & charge stands (even NAHI count)
    awaitingResponse --> awaitingReceive : RESPOND_ALLOW & steal/swap stands, wildcard changed hands
    awaitingResponse --> resolved : RESPOND_ALLOW & steal/swap stands, only fixed property moved
    awaitingPayment --> awaitingReceive : RESPOND_PAY hands over a wildcard (receiver must place it)
    awaitingPayment --> resolved : RESPOND_PAY in cash/property only
    awaitingReceive --> awaitingReceive : RESPOND_PLACE_RECEIVED (one card at a time)
    awaitingReceive --> resolved : last received card placed
    cancelled --> [*] : frame popped, turn resumes
    resolved --> [*] : frame popped, turn resumes
```

The charge **stands iff an even number of NAHI CHALEGA cards were played** — a
parity count that is proven equivalent to the spec's literal last-in-first-out
stack for chain depths 0–4 in `interrupts.test.ts`.

---

## 3. The action loop (the UI never decides a rule)

One round trip from a finger on the glass to a re-rendered board. The interaction
reducer ([`apps/mobile/src/game/interaction.ts`](../apps/mobile/src/game/interaction.ts))
is **pure and DOM-free**: it maps a UI intent to an engine `Action`, but every
action it can return was already enumerated by `legalActions`. An illegal intent
maps to nothing.

```mermaid
flowchart LR
    intent["UI intent<br/>(drop on a zone · tap a target · drag a placed wildcard)"]
    ir["interaction reducer<br/>interaction.ts — pure, DOM-free"]
    legal["legalActions(state, player)<br/>the only source of what's allowed"]
    reduce["reduce(state, action)<br/>the only thing that mutates state"]
    obs["observe(state, seat)<br/>hidden-info view"]
    render["React render<br/>(CardFace, board, sheets)"]

    intent --> ir
    ir -->|"is this action in the legal set?"| legal
    legal -->|"yes → the exact Action"| reduce
    legal -.->|"no → do nothing (illegal drop)"| render
    reduce -->|"new state + events"| obs
    obs --> render
    render -->|"next intent"| intent
```

Because both the drag layer and the tap rail funnel through this one mapping, they
fire **byte-identical actions** — a guarantee unit-tested without a browser, not
eyeballed across two components.

---

## 4. Card taxonomy — the 106-card deck

Built by [`deck.ts`](../packages/engine/src/deck.ts) from the data in
[`theme.ts`](../packages/engine/src/theme.ts). The exact 28 / 11 / 34 / 13 / 20
split and the ₹57 Cr money total are asserted by `deck.test.ts` — if the deck
drifts, the build goes red.

```mermaid
graph TD
    deck["SAUDA deck — 106 cards"]

    deck --> props["Properties · 28"]
    deck --> wilds["Wildcards · 11"]
    deck --> acts["Action cards · 34"]
    deck --> lagaan["LAGAAN / rent · 13"]
    deck --> money["Money · 20 = ₹57 Cr"]

    props --> p1["Purani Dilli 2 · Mumbai 2 · Utilities 2<br/>Kashi 3 · Jaipur 3 · Kolkata 3<br/>Chennai 3 · Bangalore 3 · New Delhi 3<br/>Junctions 4"]

    wilds --> w1["dual-colour 9"]
    wilds --> w2["ANY (₹0, never payable) 2"]

    acts --> a1["Aage Badho 10 (draw 2)"]
    acts --> a2["Vasooli 3 · Shagun 3 · Nahi Chalega 3<br/>Haath Ki Safai 3 · Adla-Badli 3"]
    acts --> a3["Makaan 3 · Haveli 2 · Kabza 2 · Dugna Lagaan 2"]

    lagaan --> l1["colour-pair (all opponents) 10"]
    lagaan --> l2["wild (one opponent) 3"]

    money --> m1["₹1×6 · ₹2×5 · ₹3×3 · ₹4×3 · ₹5×2 · ₹10×1"]
```

**Win condition:** hold **3 complete sets across 3 different colours**
(`hasThreeCompleteSets` → `distinctCompleteColorCount ≥ 3`). Two complete Jaipur
sets plus one Mumbai set is three sets but only two colours — not a win.

---

## 5. The two-layer card render

Every card on screen is one `CardFace`
([`apps/mobile/src/components/CardFace.tsx`](../apps/mobile/src/components/CardFace.tsx)).
The **art plate** is a static `.webp` painting that carries *no* text or numerals;
the **live layer** draws every number, name and icon from engine/theme data on top.
The plate gives the look; the live layer guarantees the values are correct and crisp
at any size.

```mermaid
flowchart TB
    id["cardId (e.g. prop_jaipur_1)"]

    subgraph face["one CardFace"]
        plate["Art plate (static)<br/>assets/plates/*.webp — no text ever<br/>tier chosen by on-screen width: 160 / 320 / full"]
        live["Live layer (this code)<br/>name · value badge · set label · rent ladder · icon<br/>all from engine + theme data"]
    end

    composited["Composited deed card"]
    scaled["ScaledCard(width)<br/>transform-scales the ONE face — pixel-identical at any size"]

    id --> plate
    id --> live
    plate --> composited
    live --> composited
    composited --> scaled
```

There is exactly **one** face design. To show a card smaller on the table, callers
wrap it in `ScaledCard`, which CSS-scales the *same* full render — so a table-size
deed is pixel-for-pixel the same design as the hand card. If a plate is missing, the
face falls back to a text-free SVG; art can be dropped in later with no code change.

---

## 6. The interaction contract (touch state machine)

The play surface is DRAG-first with tap as an equal fallback (M4b interaction spec,
`docs/M4B_INTERACTION_SPEC.md` / `docs/M4B_STATE_MATRIX.md`), implemented across the
Board's interaction state. A hand card is either being read (INSPECT) or being
committed (DRAG); on-board choices open one modal surface at a time.

```mermaid
stateDiagram-v2
    [*] --> REST
    REST --> PRESSED : pointer down on a hand card
    PRESSED --> INSPECT : tap (read-only float-up — no engine action)
    PRESSED --> DRAG : move past threshold
    INSPECT --> REST : dismiss
    INSPECT --> DRAG : drag from the inspected card
    DRAG --> REST : release over a legal zone → commit (or illegal → miss + hint)
    DRAG --> TARGETING : dropped a card that still needs a target/colour pick

    REST --> TARGETING : played action needs a target (VASOOLI · KABZA · HAATH · ADLA-BADLI · wild LAGAAN)
    REST --> SHEET : payment due (RESPOND_PAY — pick table cards)
    REST --> PROMPT : interrupt window (NAHI CHALEGA / allow)
    REST --> DISCARD : over the hand limit at end of turn

    TARGETING --> REST : pick complete → fire, or Cancel
    SHEET --> REST : payment submitted
    PROMPT --> REST : responded (cancel / allow / chain)
    DISCARD --> REST : discarded down to the limit
```

Only one of `TARGETING` / `SHEET` / `PROMPT` / `DISCARD` is ever live at once, and
each is driven entirely by `legalActions` — the overlay glows only the choices the
engine already allows.
