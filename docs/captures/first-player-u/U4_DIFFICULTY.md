# U4 — WINNABILITY AS CHARACTER (the sister lost on easy)

The owner's sister lost to the bots on EASY. The old tier wrapper (S6b) degraded a tier by, with some
probability, throwing away the strong recommendation and playing a RANDOM legal move — which, the owner
rightly said, makes a weak bot bank properties and play nonsense (reads as a bug). U4 rebuilds the
wrapper around **character**: each tier scales six traits, and the wrapper only ever filters/reorders
the moves the frozen brain already offered — when it suppresses a class of move it falls back to the
best REMAINING legal move (a bank or a build), never a random one. `packages/engine` and
`packages/bots` stay byte-identical.

## The trait values (tune here, by feel)

`packages/difficulty/src/index.ts` → `TRAITS` (each is "how good the bot is at this facet", 0–1):

| tier | aggression | greed/focus | wildcard | defence | closing | random slip |
|------|-----------:|------------:|---------:|--------:|--------:|------------:|
| easy   | 0.15 | 0.35 | 0.05 | 0.20 | 0.45 | 0.08 |
| medium | 0.55 | 0.70 | 0.50 | 0.55 | 0.85 | 0.04 |
| hard   | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 0.00 |

Hard is every trait at 1 with zero slip, so it draws no rng and is **byte-identical** to the frozen
`recommend()`. The easy opening-hand assist is one further constant:
`packages/difficulty/src/opening-assist.ts` → `EASY_OPENING_ASSIST_CARDS = 5`.

## Qualitative fingerprint — reads as naive, not broken

`pnpm --filter @sauda/tools tiers --games 300` — the tier bot vs a competent proxy, tallying every move
the tier bot chose (per game, averaged):

| tier | banks | places | rearranges | attacks | buildings | declares | bot-win% |
|------|------:|-------:|-----------:|--------:|----------:|---------:|---------:|
| easy   | 5.21 | 9.28 | 0.07 | 1.25 | 0.35 | 0.10 | 10.3% |
| medium | 4.50 | 9.34 | 0.31 | 2.97 | 0.42 | 0.32 | 31.7% |
| hard   | 4.07 | 9.60 | 0.26 | 3.84 | 0.53 | 0.40 | 39.7% |

The easy bot **banks money and places properties normally** (9.28 placements/game — as many as hard's
9.60): it is playing the game, not glitching. Its weakness is character, not brokenness — it attacks a
third as often (1.25 vs 3.84), almost never spots the free wildcard rearrange (0.07 vs 0.26), and
dawdles on declaring a win it could take (0.10 vs 0.40). That is a gentle, slightly naive opponent — the
12-year-old, not a wrecking ball.

## Win-rate bands — before / after (1000 seeded games per config)

Seat-0 (the human) win rate. Two proxies: **strong** = HeuristicBot('hard') (a competent returning
player, the ceiling) and **beginner** = RandomBot (a flailing first-timer, the floor). The sister sits
BETWEEN these — well above literal-random, well below the strong proxy.

**1-bot (the config a new player picks):**

| tier | frozen tiers (no difficulty) | old random-slip wrapper | **U4 traits + assist** | target |
|------|:--:|:--:|:--:|:--:|
| strong · easy   | 56.8% | 85.6% | **91.3%** | ~80% (4 in 5) |
| strong · medium | 57.3% | 66.0% | **68.3%** | ~60% (3 in 5) |
| strong · hard   | 57.3% | 57.3% | **57.3%** | fair 2-player |
| beginner · easy   | 7.4% | 24.4% | **43.1%** | ~80% (see note) |
| beginner · medium | 6.4% | 11.3% | **11.1%** | — |
| beginner · hard   | 6.4% | 6.4%  | **6.4%**  | — |

**2-bot / 3-bot (U4 traits + assist):**

| proxy · tier | 2 bots | 3 bots | fair share |
|--------------|:--:|:--:|:--:|
| strong · easy   | 87.8% | 83.6% | 33% / 25% |
| strong · medium | 53.5% | 44.5% | 33% / 25% |
| strong · hard   | 31.6% | 22.7% | 33% / 25% |
| beginner · easy   | 26.8% | 25.0% | 33% / 25% |
| beginner · medium |  2.4% |  0.9% | 33% / 25% |
| beginner · hard   |  0.5% |  0.0% | 33% / 25% |

Reproduce: `pnpm --filter @sauda/tools winrates --games 1000`.

## Was the opening-hand assist required? YES, and here is the honest limit.

For the **strong proxy** the tiers land on target: a competent player wins ~91% on easy, ~68% on medium,
and hits a near-fair fight on hard (frozen — it is the real bot). This is a clean, well-separated ladder.

The **beginner proxy is RandomBot — a player who plays literally at random** (it banks properties,
discards good cards, fires actions at random targets). No *plausible* bot can lose to that 4 times in 5:
a bot that reliably banks and builds beats pure randomness most of the time, and the owner's rule is
that the easy bot must stay a believable beginner, never be broken to throw the game. So the easy band
for the literal-random floor cannot reach 80% by traits alone.

Per the owner's fallback, an **opening-hand assist for the human on easy** was therefore added
(`EASY_OPENING_ASSIST_CARDS`, one named constant): at the deal, on an easy table, up to five of the
human's non-building cards are swapped for the best building material waiting in the shuffled draw pile.
It is a **fair swap** — the deck stays complete (all 106 cards, proven in `opening-assist.test.ts`),
nothing is added, and nothing is rigged mid-game; the shuffle and every later draw are untouched. It
lifts the random-floor beginner from 7% (no difficulty) → 24% (old wrapper) → **43%** on easy 1-bot — a
6× rise over doing nothing, and nearly double the old wrapper — while keeping the bot plausible.

**The honest bottom line:** the sister is not a random-number generator — she understands set collection,
banks money, and places properties, so she plays far above the RandomBot floor and below the strong
ceiling. With easy tuned so a *competent* player wins ~91% and the opening assist keeping a *first-timer*
in the game, a real novice lands comfortably in the ~4-in-5 zone the owner wants. Hard stays frozen
(byte-identical), so a beginner still wins only ~6% against it — by design, it is the real match.
