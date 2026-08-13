# SAUDA — STATUS

**One honest snapshot of where the build actually is.** Written 2026-08-04 at commit after LANDSCAPE-4;
**AUDIT-Z note appended 2026-08-06.** Four polish passes made the true state hard to read; this is the
map the owner and any future session can trust. It records state only — **no new work is proposed here.**

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
- **Tests:** **456 green** — engine 76 · bots 14 · difficulty 9 · tools 15 · mobile 342 (floor was 419
  before the S pass). `pnpm gate` (ip-guard → typecheck → lint → test) is green and enforced by an
  unskippable pre-commit hook.
- **Not yet shippable to a phone.** No native package, no stable hosting — today the only way onto a
  device is `pnpm phone` (an ephemeral Cloudflare tunnel that rotates every run). See "Top open threads".

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
| **M4 spec gate (tutorial + Lighthouse)** | not met | The M4 gate in BUILD_SPEC — "a friend can learn from the tutorial alone" + "Lighthouse perf ≥ 90" — is **not** satisfied: there is **no tutorial/onboarding**, and no Lighthouse run is recorded. |
| **M5 — Ship (Android)** | not started | Capacitor project, keystore + signed AAB, versionCode/Name, `store/` assets, `privacy.html`, Play data-safety answers, current target-SDK check. Nothing exists yet. |
| **Stable web hosting** | not started | No `vite build` deploy (e.g. Vercel). The only device path is the rotating quick tunnel. |
| **M6 — ML / IsmctsBot / Boss** | out of scope for now | Optional, only after M5. |
| **MP1 — online multiplayer** | out of scope for v1 | Plus accounts/backend/ads/iOS/localization — BUILD_SPEC §13. Do not add. |

## Top 5 open threads — ranked by what most blocks a real launch

1. **No stable link a friend can open.** `pnpm phone` mints a fresh tunnel URL each run and it dies when
   the terminal closes. The fastest route to a real, shareable launch is a `vite build` → static host
   (e.g. Vercel) of the landscape web app (with the rotate-gate + "Go fullscreen" shell). Until that
   exists, "playable" means "playable while the owner's PC + tunnel are up." **Biggest blocker.**
2. **No native package (M5).** For an installable app that pins landscape in the manifest (and drops the
   browser fullscreen/orientation-lock caveats entirely), the Capacitor → signed AAB → Play Store track
   is untouched. This is the "proper" launch and a larger effort than #1.
3. **Never run on a real phone.** Everything to date is emulated device profiles + one tunnel curl. Real
   touch, real Android Chrome, and battery-saver-forced reduced motion on the friend's phone are
   unverified. N3 made the link + HUD work so this test can finally happen — but it hasn't yet.
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
