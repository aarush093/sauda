# SAUDA — STATUS

**One honest snapshot of where the build actually is.** Written 2026-08-04 at commit after LANDSCAPE-4;
**AUDIT-Z note appended 2026-08-06.** Four polish passes made the true state hard to read; this is the
map the owner and any future session can trust. It records state only — **no new work is proposed here.**

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
- **Tests:** **419 green** — engine 76 · bots 14 · tools 15 · mobile 314. `pnpm gate`
  (ip-guard → typecheck → lint → test) is green and enforced by an unskippable pre-commit hook.
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
| **M4b Play screen** | ✅ done | Real cards + hand wheel, drag-to-zone/tap-to-inspect, payment sheet, targeting, discard, bank inspect, turn token + SAUDA! declare, Munshi advisor (3 uses), end overlay. Owner playtests 1–2 + excellence/close-out (H/J) folded in. |
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
5. **Polish debt surfaced by the playthrough.** The **targeting overlay is dense at 915×412** (chips fill
   the width, the My-Sets reference panel is narrow) — functional but tight; plus the deferred M4c
   feedback. Lowest launch-blocker, real debt. Details in `docs/captures/landscape-4/PLAYTHROUGH.md`.

## Where to look

- Rules & milestone spec: `docs/BUILD_SPEC.md` (§14 = landscape amendment). Deferred motion: `docs/M4C_MOTION_BACKLOG.md`.
- Interview crib / how the hard parts work: `EXPLAIN.md`. Rule interpretations & deviations: `DECISIONS.md`.
- Evidence packs: `docs/captures/` — latest is `landscape-4/` (clips `INDEX.md`, `PLAYTHROUGH.md`, `device-check/`).
- Get it on a phone now: `docs/PHONE_PLAYTEST.md` → `pnpm phone`.
