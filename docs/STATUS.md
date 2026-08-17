# SAUDA — STATUS

**One honest snapshot of where the build actually is.** Written 2026-08-04 at commit after LANDSCAPE-4;
**AUDIT-Z note appended 2026-08-06.** Four polish passes made the true state hard to read; this is the
map the owner and any future session can trust. It records state only — **no new work is proposed here.**

## FIRST-PLAYER PASS (U) — the owner's sister played the live build (2026-08-17)

The first outside player (iPhone 12, Safari) returned three real problems and one request; all four are
landed green + playable, each with committed evidence in `docs/captures/first-player-u/`.

- **U1 — true responsiveness (the iPhone 12 cut-off).** The play surface is now sized from the LIVE
  measured viewport (`visualViewport` + safe-area insets, re-fit on every resize/scroll/orientation),
  not `100dvh`/`100vw` — the root cause of the clip. Below a min playable box the whole board scales
  down rather than clipping anything (`fitToBox`, pure + invariant-tested). New iOS profiles (iPhone 12
  844×390, iPhone SE 667×375) with simulated chrome + side-notch insets; 8/8 landscape stills clean.
- **U2 — the rotate dead-end is retired.** Portrait stays playable (a compressed, centred landscape
  board) with a slim dismissible "rotate / go fullscreen" banner — no blocking gate. Native orientation
  lock arrives with the M5 Capacitor manifest.
- **U4 — winnability as CHARACTER.** The difficulty wrapper is rebuilt from random-slip to six
  tier-scaled traits (aggression, greed, wildcard, defence, closing, small residual slip); a weak bot
  now plays like a gentle beginner (banks + builds, rarely attacks/rearranges, dawdles on the win), not
  a broken one. Bands (1-bot, strong proxy): easy 91% · medium 68% · hard 57%. The easy opening-hand
  assist (one named constant) was required for the random-floor beginner and is a fair swap; full
  before/after tables + the qualitative fingerprint in `docs/captures/first-player-u/U4_DIFFICULTY.md`.
- **U3 — the guided tutorial "Sikho".** A deterministic, engine-legal demo game the player watches,
  driven by a gold cursor, teaching every move class with teaching beats that tap through to the real
  Book; auto-offered once on first visit, permanent on Home. `packages/engine` + `packages/bots` stayed
  byte-identical throughout. Tests **462 → 486**.

## DEPLOY-1 — THE PERMANENT WEB LINK (2026-08-16) — launch-blocker #1

The #1 launch blocker was "no stable link": every playtest needed the owner's laptop alive with a
rotating Cloudflare quick tunnel (`pnpm phone`), which repeatedly blocked testing. DEPLOY-1 makes the
solo, fully-client-side web build shippable to a static host (Vercel) so any phone can open it any time.

- **D1 — production build audit.** The prod build is clean (no warnings/errors, 259 modules, main JS
  320.87 kB / gzip 96.69 kB, CSS 3.24 kB; ~5.7 MB total, almost all card-art webp). Every dev-only
  surface is now dead-code-eliminated: the `#/dev/*` routes, the spread lab, `?hud`, and the
  `window.__replay/__sauda/__craft/__saudaCapturePaused` capture bridge. Three routes
  (`#/dev/card`, `#/dev/plates`, `#/dev/frame360`) and the HUD were previously reachable statically and
  leaked into the bundle — now gated behind `import.meta.env.DEV`. A grep of the built output for those
  identifiers is empty, and the globals read `undefined` in the served build. **Served the prod build
  and played it** (915-profile): Home → KHELO → setup → deal-in renders; plates load, fonts render
  (system-fallback stacks, no external font fetch), the upright spread renders, tap-to-inspect and the
  drag magnetic-assist are live, the portrait rotate-gate + "Go fullscreen" work, **zero console
  errors**. (Driving to literal gameOver needs manual drag precision the synthetic-drag harness can't
  commit — identical dev-or-prod, not a build defect.)
- **D2/D3 — deploy config landed, one owner login from live.** `vercel.json` is committed (build cmd,
  output dir, install cmd, SPA rewrites) and the exact build command is verified from the repo root.
  The Vercel CLI runs (v59.1.3, Node 24.15.0) but reports **Logged out** — `vercel login` is
  interactive and only the owner can do it (it must not be automated). The repo also has **no git
  remote** yet, so auto-deploy needs the owner to create a GitHub repo + push. **Both owner steps are
  written out precisely in `docs/DEPLOY.md`** (a 2-command CLI deploy, plus the GitHub route that gives
  fix → push → open-same-URL auto-deploy).

**Net:** the stable-link blocker is engineered shut — the moment the owner runs the two documented
commands, SAUDA has a permanent `*.vercel.app` URL. The rotating-tunnel dependency is retired.
`packages/engine` + `packages/bots` stayed byte-identical (the only code change was DEV-gating dead
routes in `apps/mobile/src/App.tsx`). Tests held at **462** (floor).

## S — HAND + INFO REDESIGN (2026-08-13) — the owner playtest pass

Six owner directives, all landed green + playable across two passes (12 commits). What S changed:

- **S6 — fairness (the owner lost every game).** Root causes found & fixed: (a) `#/autostart` dealt one
  FIXED seed (424242) forever → now a fresh crypto seed per game, `?seed=<n>` to replay one; (b) the
  three bot tiers were nearly identical (medium ≡ hard) → a new `packages/difficulty` wrapper degrades
  the frozen `recommend()` by tier. Measured (1000 games, 3-bot table, strong player): **easy ~74% ·
  medium ~46% · hard ~23%** (hard = the real bot ≈ fair share). Munshi stays full-strength. Setup card
  now states each tier + expected win share.
- **S1 — the SPREAD.** The rotated wheel is retired for a flat row of UPRIGHT cards; rest card **~98 px**
  at the 915 profile (was ~69), lifting the value badge to **10.4 device-px** (clears the H3 floor with
  the toggle OFF). `spreadLayout` invariants replace the wheel's, count held.
- **S2 — hidden bot cash.** An opponent's exact bank is private (bluff tension); only the note COUNT is
  public. My own bank unchanged; debts stay explicit.
- **S3 — targeting = real cards** for all five targeted actions (was text pills), + a difficulty-gated
  best-target hint (easy/medium bounce+glow, hard none).
- **S4 — wildcard combination assistant:** a quiet "◈ arrange" nudge → preview → Confirm fires free
  REARRANGE moves; never auto-executes. The owner's pink-pink-dual resolves.
- **S5 — sweep:** the bigger cards cause no collisions at either profile (turn token/tray/discard/spectate).

**T — verification + closure (2026-08-15, 4 commits).** Proved the claims that were only argued: (T1)
the difficulty tier reaches LIVE play — three games at one seed diverge by tier in a browser (P1 places
the wildcard on hard, plays Aage Badho on medium, banks on easy); `#/autostart` gained `?difficulty=` +
`?bots=` and the HUD shows the live tier. (T2) NO p95 regression from the bigger card (spread scrub+drag
p95 16.7–16.8 ms at both profiles), and legibility ROSE (badge 7.3 → 10.4 device-px — the earlier
"unchanged" note was wrong); hard's win band landed at ~23% not 25–30 (it IS the real bot, can't raise
without weakening it). (T3) the assist hint now fires on ADLA-BADLI's second pick too, and the arrange
nudge anchors to the affected group. (T4) Home → KHELO → setup (difficulty + win-share copy) → DEAL →
#/play works at both profiles; `pnpm phone` serves HEAD over the tunnel (deep-link
`…/?difficulty=easy&bots=3#/autostart`). Evidence: `docs/captures/hand-info-1/` (INDEX + `t1_`/`t3_`/`t4_`
stills + `verify-*.json`).

The difficulty tiers now MEAN: **easy** = bots often misplay (a forgiving game to learn on); **medium**
= a solid game with the odd slip; **hard** = full-strength (the ~95.8%-win bot, a near-fair fight at 3
opponents). Evidence pack: `docs/captures/hand-info-1/INDEX.md`. `packages/engine` + `packages/bots`
stayed byte-identical throughout (the difficulty wrapper + assistant only sequence their existing output).

## AUDIT-Z (2026-08-06) — the demanding-user pass, post-audit

A full quality audit drove the real build through both landscape profiles: **5 full solo games across 5
seeds finished with zero page-scroll / console-error / soft-lock / unhandled-phase / stuck-bot events.**
Property placement by drag (incl. the first property of a new colour) and overlay dismissal were driven
live and pass. **No BROKEN behaviour, soft-lock, occluded caption, page scroll, or input-trap was found
in the app.** The one code change was removing dead code (Z1: orphaned `DropBand` + `suppressDrop`). The
launch-blocker ranking below is **confirmed unchanged** by the audit — the blockers are the deferred-by-
decision items, not defects. Two additions to the flag list: **value-badge legibility floor ships OFF**
(`badgeFloor`, owner A/B call) and **pass-and-play exists but is unexposed** (owner: expose or remove).
Full report + evidence: `docs/AUDIT_Z.md`; driven log `docs/captures/audit-z/audit-z-results.json`.

## Headline

- **Playable, end to end, on the web.** A full solo game (you vs 3 bots) deals, plays and wins in a
  real browser at the landscape profiles. First true deal→win playthrough proven in
  `docs/captures/landscape-4/PLAYTHROUGH.md` (human win, turn 37, all six screen states PASS).
- **Tests:** **486 green** — engine 76 · bots 14 · difficulty 18 · tools 15 · mobile 363 (was 462
  before the first-player pass U). `pnpm gate` (ip-guard → typecheck → lint → test) is green and enforced
  by an unskippable pre-commit hook.
- **Web-shippable — stable hosting is one owner login away (DEPLOY-1).** The Vercel deploy is fully
  configured and committed (`vercel.json`, dev surfaces stripped, build verified); the permanent
  `*.vercel.app` URL goes live the moment the owner runs the two commands in `docs/DEPLOY.md`. Until
  then the rotating `pnpm phone` tunnel still works as a stopgap. **Still no native package** (M5).

## Milestones — done

| Milestone | Status | What "done" means here |
|-----------|--------|------------------------|
| **M0 Scaffold** | ✅ done | pnpm workspaces, TS strict, ESLint/Prettier, vitest, CI script; engine types, `theme.ts`, deck builder. |
| **M1 Engine** | ✅ done | Full rules (§4–§8.2), all 20 named edge cases, property/invariant test over many random games, fixtures exported. Seeded RNG only — no `Math.random` in the engine. |
| **M2 Bots + CLI** | ✅ done | RandomBot + HeuristicBot; `pnpm play` (human vs 3 bots); `pnpm simulate`. Simulator gate met: 0 invariant violations, ≥90% win rate, ≤25 avg turns. |
| **M3 Mobile core** | ✅ done | Playable Table screen vs bots + pass-and-play hand-off; every move from `legalActions`; complete game start→win on web. |
| **M4a Deed Card layer** | ✅ done | The live card face (CardFace/ScaledCard) — one design, crisp at every size; badge legibility floor. |
| **M4b Play screen** | ✅ done | Real cards + hand SPREAD (S1; was the wheel), drag-to-zone/tap-to-inspect, payment sheet, real-card targeting (S3), discard, bank inspect (redacted for opponents, S2), turn token + SAUDA! declare, Munshi advisor (3 uses), wildcard arrange assistant (S4), end overlay. Owner playtests 1–2 + excellence/close-out (H/J) + the S pass folded in. |
| **K — feel + shell** | ✅ done | One continuous motion pass (drag physics, magnetic assist, fling-to-commit, bot reveal/travel), bank tray, turn token, TableView, crispness law, Home + Book (Niyam), pause sheet. |
| **PHONE-1 / PHONE-2** | ✅ done | Real-device recovery: real-viewport layout (no void/scroll), layer audit, thumb-sized drops, reduced-motion split + pacing floors, wheel spread/magnify, in-game nav; PHONE-2 closed the gaps (Munshi, reduced-motion proof). |
| **LANDSCAPE R / -1 / -2 / -3 / -4** | ✅ done | Landscape-only rebuild (spec §14): orientation shell, focus-follows-turn (MY-TURN / SPECTATE), stage captions, payment freedom + overpay, targeting split with My-Sets reference, Munshi nuanced advice + portrait, table band, `pnpm phone` tunnel. **LANDSCAPE-4** (this pass): the six motion clips re-rendered at HEAD on both profiles, the first true end-to-end playthrough, device-reality double-check, this file. |

"Done" for the M4x/K/PHONE/LANDSCAPE passes means: implemented, `pnpm gate` green, and evidenced by a
committed capture pack under `docs/captures/`. It does **not** mean the M4 *spec gate* is met — see below.

## Explicitly DEFERRED (not started / partial — by decision, not omission)

| Item | State | Notes |
|------|-------|-------|
| **M4c — motion/juice/sound** | deferred | Stamp-slam victory, FULL-ribbon slide, drop-zone/commit feedback, received-card travel, overlay open/close transitions, wheel peek ease, Munshi bouncing arrow, **sound + haptics**. Catalogued in `docs/M4C_MOTION_BACKLOG.md`. None are bugs. |
| **M4 spec gate (tutorial + Lighthouse)** | partial | **The tutorial now exists** (U3 "Sikho" — a guided demo teaching every move, tied to the Book). The remaining gap is a recorded **Lighthouse perf ≥ 90** run. |
| **M5 — Ship (Android)** | not started | Capacitor project, keystore + signed AAB, versionCode/Name, `store/` assets, `privacy.html`, Play data-safety answers, current target-SDK check. Nothing exists yet. |
| **Stable web hosting** | configured, not yet live | DEPLOY-1: `vite build` → Vercel is fully set up (`vercel.json` committed, dev surfaces stripped, build verified). Goes live on one owner `vercel login` + `vercel --prod`. See `docs/DEPLOY.md`. |
| **M6 — ML / IsmctsBot / Boss** | out of scope for now | Optional, only after M5. |
| **MP1 — online multiplayer** | out of scope for v1 | Plus accounts/backend/ads/iOS/localization — BUILD_SPEC §13. Do not add. |

## Top 5 open threads — ranked by what most blocks a real launch

1. **Stable link — DONE bar one owner login (DEPLOY-1, was the biggest blocker).** The `vite build` →
   Vercel static deploy is fully prepared and committed: `vercel.json`, dev surfaces stripped from the
   prod bundle, the rotate-gate + "Go fullscreen" shell confirmed in the built app, build command
   verified from repo root. What remains is **owner-only**: `vercel login` (interactive) then
   `vercel --prod`, or create a GitHub repo + import it for push-to-deploy. Exact steps in
   `docs/DEPLOY.md`. Once run, `pnpm phone` is retired for good.
2. **Never run on a real phone.** Everything to date is emulated device profiles + one tunnel curl.
   Real touch, real Android Chrome, and battery-saver-forced reduced motion on a friend's phone are
   unverified. The live URL (thread #1) is what finally lets this happen — the web build is the
   parallel feedback path while the M5 Play-Store 14-day tester clock is untouched.
3. **No native package (M5).** For an installable app that pins landscape in the manifest (and drops the
   browser fullscreen/orientation-lock caveats entirely), the Capacitor → signed AAB → Play Store track
   is untouched. This is the "proper" launch and a larger effort than #1.
4. **No onboarding + no sound/juice (M4 gate + M4c).** A first-time player gets no tutorial and no audio/
   haptic feedback; the M4c feedback motions (commit/victory/received-card) are stubs. A cold launch to a
   friend would lean entirely on the Munshi advisor and the rules Book.
5. **Polish debt — largely retired by the S pass.** The targeting overlay's text-pill density is gone
   (S3 rebuilt it as real cards that scroll internally); the hand reads clearly (S1 spread + size-up);
   fairness and info-leak debt are closed (S6/S2). What remains here is the deferred **M4c feedback
   motion** (commit/victory/received-card stubs) — lowest launch-blocker. Details:
   `docs/captures/hand-info-1/INDEX.md`, `docs/captures/landscape-4/PLAYTHROUGH.md`.

## Where to look

- Rules & milestone spec: `docs/BUILD_SPEC.md` (§14 = landscape amendment). Deferred motion: `docs/M4C_MOTION_BACKLOG.md`.
- Interview crib / how the hard parts work: `EXPLAIN.md`. Rule interpretations & deviations: `DECISIONS.md`.
- Evidence packs: `docs/captures/` — latest is `landscape-4/` (clips `INDEX.md`, `PLAYTHROUGH.md`, `device-check/`).
- Get it on a phone now: `docs/PHONE_PLAYTEST.md` → `pnpm phone`.
