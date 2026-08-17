# W3 — Landscape fit, re-verified after W1

W1 removed the U2 portrait fallback, so the board's landscape path now always lays out at the **full
measured content box** (no portrait-compression branch). This re-verifies the measured-box system at the
two owner iPhone landscape profiles, **with simulated browser chrome and safe-area insets**, and adds the
one check the U1 invariant suite never made: the real upright **hand card fits inside its wheel band**, so
an 11-card hand is never clipped off the bottom — the exact failure the owner rejected in portrait.

All numbers are computed by the pure layout maths (`viewport.ts` · `landscapeLayout.ts` · `spreadLayout.ts`)
and **locked by `landscapeFitW3.test.ts`** (green). CSS px; a real device is above the min playable box, so
`fitToBox` lays out at **scale 1.0** (no shrink, no letterbox).

## iPhone 12 landscape — 844×390 @3, chrome 44px, insets L/R 47 · bottom 21

Content box after chrome + insets: **750 × 325** (width 844−47−47 · height 390−44 chrome−21 bottom), scale **1.0**.

| Zone | Height / Width | Note |
|------|----------------|------|
| **Rows** topRow · wheelBand | 175 · 150 | sum **325 == box height** — no page scroll, no dead zone |
| **Columns** rail · leftCol · centre · rightCol | 46 · 141 · 398 · 141 | + 3×8 gutters ≤ 750 width, no right clip |
| **Spectate** rail · acting · mine | 46 · 404 · 292 | + gutter = **750 == box width** |
| **Hand (11)** cardW · cardH | 81 · **117** | cardH **117 < wheelBand 150** — hand not clipped |
| **Hand (11)** step · rowWidth | 62.3 · 704 | step ≥ readable strip 26; rowWidth **704 == container** (centred, no side clip) |

## iPhone SE landscape — 667×375 @2, chrome 44px, no notch (home-button phone → insets 0)

Content box after chrome: **667 × 331** (width 667 · height 375−44 chrome), scale **1.0**.

| Zone | Height / Width | Note |
|------|----------------|------|
| **Rows** topRow · wheelBand | 179 · 152 | sum **331 == box height** — no page scroll, no dead zone |
| **Columns** rail · leftCol · centre · rightCol | 46 · 128 · 341 · 128 | + 3×8 gutters ≤ 667 width, no right clip |
| **Spectate** rail · acting · mine | 46 · 356 · 257 | + gutter = **667 == box width** |
| **Hand (11)** cardW · cardH | 71 · **103** | cardH **103 < wheelBand 152** — hand not clipped |
| **Hand (11)** step · rowWidth | 55 · 621 | step ≥ readable strip 23; rowWidth **621 == container** (centred, no side clip) |

> The SE has no notch, so its safe-area insets are genuinely zero — that is physically correct, not a
> gap in the evidence. The iPhone 12 profile carries the non-zero landscape side + home-indicator insets,
> and the fit above already carves them off. The reduced-motion Wide profile and the four rotated-Android
> profiles also pass every check (`landscapeFitW3.test.ts` second block: the hand card fits its band on
> **every** profile).

## The six states

The board's zone geometry (the table above) is the **rest** state and is unchanged by an **11-card hand**
(the wheel band is a fixed-height row; the hand fits it, as proven). The other four states are **fixed,
full-screen surfaces layered above the board**, not new board geometry — each is `position:fixed; inset:0`
with internal scroll where its content is tall, so none can grow the page:

| State | Surface | Fits by |
|-------|---------|---------|
| Rest | Board (MY TURN zones) | zone table above; rows tile the box exactly |
| 11-card hand | HandSpread in the wheel band | cardH < wheelBand; rowWidth == container (both profiles) |
| Targeting | `TargetingOverlay` (fixed, scrolls internally) | `TargetingOverlay.test.tsx` (8 tests) |
| Payment | `PaymentSheet` (fixed bottom sheet) | `PaymentSheet.test.tsx` (2 tests, incl. overpay) |
| Discard | `DiscardOverlay` (fixed full-screen spread) | `DiscardOverlay.test.tsx` (3 tests) |
| End | `EndOverlay` (fixed scrim + panel) | renders above every in-play surface (LAYERS.end) |

The app shell is `overflow:hidden; overscroll-behavior:none` sized to the live `visualViewport`, so the
document is exactly the viewport height at every profile — **no page scroll in any state**.

## How to reproduce

```
pnpm --filter @sauda/mobile test -- --run landscapeFitW3
```

Green = the fit holds at both iPhone profiles (with chrome + insets) and the hand fits its band on every
profile. The numbers above are the exact outputs of the same pure functions the app renders from.
