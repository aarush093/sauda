# M4B Excellence Pass (H) — evidence report

Judged on measurements + recordings, not assertions. All frames/clips at a **360×740 viewport,
deviceScaleFactor 2**, driven through the committed `window.__replay` hook. Clips are `.webm`
(motion on); stills are `.png` (frozen). Reruns: `pnpm --filter @sauda/mobile capture:excellence`,
`… measure --mode=<legibility|overlap|profile>`, `pnpm --filter @sauda/tools exec tsx src/measure-pacing.ts`.

**`packages/engine` + `packages/bots` are byte-identical to the pass-start commit `91755c9`** (`git diff --stat 91755c9 HEAD -- packages/engine packages/bots` is empty). No M4c juice added (the wheel-glide carve-out is unchanged; H5 pacing constants are functional). Locked visuals untouched.

**Test count: 254 → 262** (engine 76 · bots 14 · tools 15 · mobile **149 → 157**). +2 wheel no-overlap (H2b), +6 bot-pacing (H5). Never below the 254 floor.

## Commits
| Commit | Scope |
|---|---|
| `b1e6cec` | H0 recording + measurement infra (dev-only, tree-shaken) |
| `8feefae` | H2 End turn → header · H1a opponent tap · H3 wheel legibility |
| `7715fe9` | H5 bot pacing constant table |
| `669a097` | H4 memoize card faces + preload plates |
| `e7d9ec4` | H7 header declutter (End turn clears Munshi) |
| `0c092b3` | captures + measurements + audit |

---

## H0 — recording infra
`apps/mobile/scripts/capture-excellence.mjs` records `.webm` clips (Playwright `recordVideo`, 720×1480 = DPR2, motion on, one scene per clip) and `.png` stills (frozen, reduced-motion), reusing the running dev server (never spawns another). `excellence-measure.mjs` is the DOM/CDP measurement harness. Both are Node scripts outside `src/`; Playwright stays a `devDependency`. The dev-only `#/dev/wheel/<n>` route (`import.meta.env.DEV`-gated → tree-shaken) renders the real `HandWheel` at any hand size for the H3 n-series + glide. Prod bundle unaffected by the tooling; the dev render-tally, `__replay`, and `#/dev/*` routes are all `DEV`-gated.

## H1 — proof debt paid
Every moving thing is a committed clip (see `INDEX.md`).

**H1a — opponent expand, discoverability verdict.** Audit: opponent expand WAS wired (`onClick` at `Board.tsx`, `cursor:pointer` at `BoardParts.tsx:199`) so it worked on click — but the only affordance was the hover cursor, **invisible on a touch screen**, which is why pass 2 said "only my groups carry the affordance." **Fixed, not code-only:** the whole opponent column is now the tap target and each pill carries a visible gold **⤢** expand glyph. Proof: `H1_opponent_expanded.png` (tapping Bot 1 opens their TableView — all sets as large real cards, "Bank ₹14 Cr", Bangalore FULL).

**H1b — received flow, on film.** `find-receive.ts` found seed 1 (24 actions) landing seat 0 in `awaitingReceive`. Clip `H1_received_flow.webm` + still `H1_received_stage.png`: the wildcard sits on centre stage ("Drag it to a glowing set"), its two colour-sets (newDelhi · junction) glow, and it drags home (`RESPOND_PLACE_RECEIVED`). *Note: this instance arrives via a HAATH KI SAFAI steal of a wildcard — the engine correctly opens a placement CHOICE for a stolen wildcard (it can join either colour); the same stage surface serves a payment-received wildcard. This contradicts the pass-2 note "steals auto-place" (flag 5).*

**Camera-out clips:** `H1_wheel_scrub_11` (11-card wheel scrubbed end to end) · `H1_drag_to_bank` (money → bank, hot glow, commit + glide) · `H1_discard_overlay` (over-limit overlay end to end, burying to 7) · `H1_bot_turn` (a full paced bot turn).

## H2 — End turn: the silent reversal audited

**a) FUNCTIONAL — NOT a regression.** Render condition at `Board.tsx` (now header): `endTurnAction && onAct && !autoEnding`. The engine offers `END_TURN` **unconditionally** during `playing` (`legal.ts:135`, *outside* the `if (state.playsRemaining > 0)` block at `:129`). `shouldAutoEndTurn` returns true **only** when `legalActions` is exactly `[END_TURN]` (`interaction.ts:283-285`; 6 unit tests). So with plays remaining, `autoEnding` is false → the manual End turn renders and is reachable → **ending early while holding plays is always possible.** Proof: clip `H2_endturn_early.webm` (my turn, "1 plays left", End turn visible, click ends the turn early).

**b) GEOMETRIC — real overlap, relocated.** Pass 2 floated End turn at `right:4/bottom:8` of the wheel band and waved off overlap as "usually hidden." Measured (`overlap.json`), the ~84×44 button overlaps the splayed readable tops of the outer wheel cards:

| container width | hand sizes n where a card overlaps the corner button |
|---|---|
| 346px | **n = 5,6,7,8,9,10,11,12** |
| 436px | **n = 9,10,11,12** |

Live at n=11: 4 cards (`prop_bangalore_0`, `action_vasooli_2`, `prop_newDelhi_1`, `action_adlaBadli_0`) under the button, which (with pointer events) also **blocked scrubbing them**. **Chosen slot:** the my-area header, by the bank — geometrically disjoint from the wheel band, so `SPAN_MAX` stays 120 (wheel widest). Unit-tested in `wheelLayout.test.ts` (the old in-band corner overlaps a card at many n; the header slot overlaps none at any n∈1..12 @ {346,436}). The header was decluttered (H7) so End turn clears the Munshi chip by 29px. Declare SAUDA! already lives clear in centre stage (A11).

## H3 — wheel legibility, measured (`legibility.json`)
DPR 2 → **rendered device px = face font × faceScale × 2**. Card size is constant across n (depends only on container width); only the visible strip varies with n.

| metric | bar | BEFORE (hub 0.42, width×0.20) | AFTER (hub 0.34, width×0.21) |
|---|---|---|---|
| rest card width @346 board | — | 66px (faceScale 0.50) | **69px** (faceScale 0.523) |
| banner text (set-name title, font 9) | ≥ 9 device px | 9.0 (**at floor**) | **9.4** ✓ |
| value-badge numerals (font 7) | ≥ 10 device px | 7.0 ✗ | **7.3 ✗ (flag 1)** |
| visible outer-strip %, worst n≤12 | ≥ 26% | 91.8% ✓ | **88.3%** ✓ |
| wheel band height (budget ~142) | ≤ budget | 144 | **142** ✓ |

The wheel is at the **my-area vertical ceiling** (~142px; the on-board cascades — frozen per H6 — take the rest), so the only lever is hub depth. 0.34 is the deepest hub still passing no-clip that clears the banner bar with margin. The no-clip invariant suite stayed green throughout (30 tests). Stills `H3_wheel_n{2,5,7,9,11}.png`; scrub under 4× CPU throttle `H3_wheel_scrub_throttle.webm`; glide-vs-drag interplay `H3_glide_vs_drag.webm`. **The value-badge bar is geometrically unreachable in the wheel (flag 1).**

## H4 — performance budget (`profile-after.json`; late-game board S6_haveli, 4× CPU throttle)

**Frame times (p95, ms):**
| interaction | budget | BEFORE (no memo) | AFTER |
|---|---|---|---|
| wheel glide | ≤16.7 target | **33.4** | **16.8** ✓ |
| active drag pointermove | ≤16.7 | 16.8 | 16.7 ✓ |
| TableView open/close | ≤16.7 | (n/a) | 16.8 ✓ |
| bot turn beats | ≤16.7 | 16.8 | 16.8 ✓ |

**Re-render audit (dev tally, StrictMode-doubled — the ratio is the point):** during a 24-move drag, **CardFace renders 216 → 2** (only the dragged preview layer). The board's real-card cascades no longer re-render per pointermove; only the dragged layer + zone glows update. Fix: `React.memo` on `CardFace` + `ScaledCard` + `SetCascade`.

**Plates:** 45 plates (600×870 webp) fetch-preloaded at game start (retaining the `Image` refs — a GC'd Image cancels its own in-flight fetch, which had left money plates uncached). **Mid-game plate network fetches 3 → 0.**

**ScaledCard method — KEPT transform-scale** of the full 132px DOM face (the G4 "one design, pixel-identical at every size" law): at DPR 2/3 the face renders at 264/396 device-px then GPU-downscales (crisp vector text + downsampled plate); the scale is a cheap compositor transform; a native-small render would still decode the full webp (no memory win) while duplicating size logic and risking sub-pixel font rounding.

**Image memory:** 3.36 MB encoded cached; a full decode of all 45 would be **~90 MB RGBA** (≈2 MB/plate) so decode stays async-per-display (`<img decoding="async">`), not forced up front (flag 4). **DOM:** 1430 nodes on the late-game board — not wild, no trimming.

**Flag 3:** two one-frame TRANSITIONS still breach the 33ms ceiling under 4× throttle — TableView open (mounts ~10 large cards, 83ms) and a play-commit that triggers the glide (66ms). Sustained interaction is within target; these are mount/commit costs (progressive mount / lighter open = M4c).

## H5 — bot pacing (`measure-pacing.ts`, 60 seeded games, 1093 inter-turn gaps)
One constant table (`botBeatDelayMs`, 6 unit tests): first beat 700ms, subsequent 450ms, floor 350ms, trimming toward the floor near a ~3s per-turn cap — never skipping a card.

| human inter-turn wait | OLD (flat 700ms) | NEW (paced) |
|---|---|---|
| median | 4.20s | **3.45s** (−18%) |
| p95 | 10.50s | **7.55s** (−28%) |
| max | 14.70s | **11.00s** (−25%) |

The owner vetoes in playtest if it feels rushed.

## H7 — ideal-state self-audit
Every fixture state re-driven through the dev frame; the dev scroll guard stayed **silent across all 14 fixture states + 6 composites + the game-over overlay** (`audit/INDEX.md`; end-overlay checked live: `gameOver`, scrollHeight 740 = viewport, 0 warnings).

| State(s) | Laws walked | Verdict | Evidence |
|---|---|---|---|
| S1/S2 (NAHI hold/chain) | L1 · L2 · D1/D3 | PASS — one live prompt, ticker narrates | `audit/S1_nahi_hold.png`, `S2_nahi_chain.png` |
| S3 (pay from bank) | G4 · C1/C3 · F3 · G7 | PASS — real notes + wildcard face, exact ₹2, Munshi ◈ | `audit/S3_pay_from_bank.png` |
| S4 (zero payable) | L1 · C4 | PASS — auto-resolve beat + ticker | `audit/S4_zero_payable.png` |
| S5 (discard) | G3 · A8/A9 · L2 | PASS — full-screen real-card overlay | `H1_discard_overlay.webm` |
| S6 makaan/haveli | B19 · G4 | PASS — real cascades, buildings | `audit/S6_*.png` |
| S7 (wild LAGAAN) | B14 · G5 | PASS — finished wild-LAGAAN face | `audit/S7_wild_lagaan.png` |
| S8 dugna x2/x4 | B15 · L6 | PASS — attach chip, extra plays | `audit/S8_dugna_*.png` |
| S9 kabza/adla-badli | B13/B16/B18 · L5 | PASS — only legal targets glow | `audit/S9_*.png` |
| S10 (11 cards) | G2 · A2 · H2b · H3 | PASS — wheel no-clip, End turn header, no scroll | `H2_endturn_header.png`, `H3_wheel_n11.png` |
| S11 → declare | A11 · F6 · G4 | PASS — SAUDA! overlay, winner sets real, no scroll | `H7_end_overlay.png` |
| received (seed 1) | G6 · C7 · L3 | PASS — card on stage, sets glow, drag home | `H1_received_flow.webm` |
| all opponents | G4 · H1a | PASS — real cascades + ⤢ tap-to-expand | `H1_opponent_expanded.png` |

No unambiguous violations found → no per-state fix commits. The one discrepancy (steal-of-wildcard opening a placement choice vs the pass-2 "steals auto-place" note) is a doc-accuracy flag, not a UI bug (the UI handles it correctly).

## Flags (ordered by how much they need the owner)
1. **H3 — wheel value-badge legibility can't hit the 10-device-px bar (7.3px).** Reaching it needs a ~94px card → ~201px band, 59px over the my-area budget (would scroll — violates A2) and clips the arc at n≥11; the 7px badge font is a locked face. Full value legibility is on tap-to-inspect. **Owner call:** accept the wheel as a "glance" surface, or approve a taller my-area / smaller on-board cascade (see flag 2) to grow the wheel.
2. **H6 — on-board cascade SIZE stays OPEN (awaiting owner playtest).** It bounds the wheel's vertical budget (flag 1), so the two are a joint decision. Unchanged this pass.
3. **H4 — two one-frame transitions (TableView open 83ms, play-commit 66ms) breach the 33ms ceiling under 4× throttle.** Sustained interaction is within budget; these are mount/commit costs. M4c: progressive card mount / lighter open transition — or owner accepts a single transition hitch on a budget device.
4. **H4 — full plate decode is ~90MB; chose fetch-preload + async-per-display decode.** If on-device decode hitches appear, the fix is downscaled/responsive plate variants (M4c), not a 90MB upfront decode.
5. **H7 — pass-2 note "steals auto-place" is imprecise** (docs only). The engine correctly opens a placement CHOICE for a stolen WILDCARD; the received-flow UI already handles it. No code change.
