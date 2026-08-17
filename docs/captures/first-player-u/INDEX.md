# FIRST-PLAYER PASS (U) — evidence pack

The owner's sister (iPhone 12, Safari, landscape) played the live build and the hand cards were
**clipped at the bottom**. U1 replaces the static-viewport-unit layout with a LIVE MEASURED viewport
(visualViewport + safe-area insets, re-fit on every resize/orientation/scroll) and, below a min
playable box, scales the whole board down rather than clipping anything.

## U1 — nothing clips on the two iOS Safari devices real testers hold

Stills captured with the two dimensions Playwright doesn't render on its own **simulated**:

- **browser chrome** — the viewport is shrunk to the profile's *usable* height (`height − chrome`), i.e.
  what `visualViewport.height` reports once Safari's URL bar / tab strip take their share (44 px here).
- **safe-area insets** — fed to the app via the dev-only `window.__saudaInsets` (Chromium can't emulate
  `env(safe-area-inset-*)`); on the iPhone 12 the landscape notch sits on the **sides** (L/R 47 px) plus
  the home indicator (bottom 21 px). The iPhone SE is a home-button device — no notch, no insets.

Each still is **self-verified in the harness**: every rendered card's bounding box sits fully inside the
measured viewport, and the document does not scroll. A clip or a page scroll FAILS the entry — it is not
silently passed. `results.json` carries the raw counts.

| Still | iPhone 12 (844×390, chrome 44, side notch) | iPhone SE (667×375, chrome 44) |
|-------|--------------------------------------------|--------------------------------|
| Rest state | `rest__844x390.png` | `rest__667x375.png` |
| 11-card hand (bottom-edge worst case) | `hand11__844x390.png` | `hand11__667x375.png` |
| Targeting split (HAATH KI SAFAI played) | `targeting__844x390.png` | `targeting__667x375.png` |
| Payment sheet (charged, pay from bank) | `payment__844x390.png` | `payment__667x375.png` |

**Result: 8/8 stills clean — 0 cards clipped, 0 page scroll, on both profiles.** The 11-card hand — the
worst case for the bottom edge — shows all eleven cards fully visible above the bottom edge, with the
board correctly inset from the side notch.

## The invariant (provable, no browser)

`apps/mobile/src/game/viewport.test.ts` proves the promise on pure geometry: `fitToBox` never overflows
the measured box and always stays ≥ the min playable box, and the landscape zone maths — run on the
fitted layout box and scaled back down — land **every element inside the measured content box** across a
dense sweep of viewport sizes (widths 360→960, heights 200→440, including short chrome-reduced boxes
well below the min box) and for every device profile.

## U2 — the rotate dead-end is retired (portrait stays playable)

The old full-screen "Rotate your phone to play" card was a wall — a browser can't force orientation
outside fullscreen, so a player who couldn't rotate was stuck. U2 removes the block: in portrait the
game lays out a **compressed, centred landscape board** (bottom-aligned so the hand sits in the thumb
zone) and shows a **slim, dismissible banner** — "Rotate for the full view" + Go fullscreen — that never
covers the board. Same self-verification (no card clipped, no page scroll).

| Portrait still | iPhone 12 (390×844) | iPhone SE (375×667) |
|----------------|---------------------|---------------------|
| Rest + banner | `portrait_rest__390x844.png` | `portrait_rest__375x667.png` |
| 11-card hand | `portrait_hand11__390x844.png` | `portrait_hand11__375x667.png` |

**Result: 4/4 portrait stills clean — 0 cards clipped, 0 page scroll.** The board is smaller than in
landscape (the banner says as much), but every zone is present and reachable and the full 11-card hand
sits above the bottom edge. Landscape remains the full experience; portrait adapts rather than blocks.
Native orientation lock proper arrives with the M5 Capacitor manifest (DECISIONS "U4").

Rerun: `pnpm dev:lan` in one shell, then `pnpm --filter @sauda/mobile capture:firstplayer`.
