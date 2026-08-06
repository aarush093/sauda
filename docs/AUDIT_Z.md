# AUDIT-Z — the final "play it like a demanding user" quality audit

**One honest sweep of every specced/promised behaviour, verified at HEAD, with a verdict and evidence
per finding.** The standard is not "does it work" — it is "would a player who paid for this feel it is
clean." The owner has no Android device this pass, so the auditor stood in as the user, driving the real
build in a real browser at both landscape profiles.

## Ground truth (verified this pass)

- **HEAD:** `87f5f07` (this pass's Z1 fix) on top of `20bc0d4` (LANDSCAPE-4 N4).
- **`pnpm gate` green** at HEAD: ip-guard → typecheck → lint → test all pass.
- **Tests: 419** — engine 76 · bots 14 · tools 15 · mobile 314. **Unchanged** by this pass (Z1 removed
  dead code only; no test was weakened or deleted — the one `LAYERS.dropBand` ordering-array entry was
  dropped because the token it named is legitimately gone).
- Read for this audit: `docs/STATUS.md`, the `DECISIONS.md` tail, `docs/M4B_SPEC_v1.2.md` (+ the L/G/K/
  PHONE/LANDSCAPE amendments threaded through DECISIONS), `docs/captures/landscape-4/PLAYTHROUGH.md`, and
  the capture INDEX/report packs for the K/P/Q/R/excellence/landscape passes.

## Method — three lenses

1. **CODE LENS** — grep/read the implementing code: is the behaviour wired, or stubbed/partial/dead? A
   full drift sweep of `apps/mobile/src` + `packages/` was run for the classic drift shapes (a constant
   defined-but-unread, a component built-but-unmounted, a prop threaded-but-ignored, a no-op toggle).
2. **DRIVEN-BROWSER LENS** — real Chromium at the exact device profiles `tall-915x412` and
   `legacy-740x360`, driven through the committed `window.__sauda` / `__replay` hooks:
   - **`scripts/audit-z.mjs`** — plays **5 full solo games** (seeds 7/13/99 at 915×412, 7/21 at 740×360)
     to a real win, asserting at every state: no page scroll, no console error, no soft-lock, no
     unhandled phase, no stuck bot; and driving a bounded number of **real lift→drag→drop property
     placements** onto the set zones. Machine log: `docs/captures/audit-z/audit-z-results.json`.
   - **`scripts/probe-place.mjs`** — the decisive placement probe (the DropBand case): a careful real
     drag placing both an existing-group extension and a new-colour first property.
   - Live overlay dismissal driven in the session browser (bank inspect: open → ✕ → closed, no scroll).
3. **USER LENS** — at each reached state, the demanding-player questions: can I read what matters? do I
   know whose turn it is / what just happened? did anything teleport? did text overlap or clip? did a tap
   do nothing? was any wait dead air? could I always tell WHY a move was unavailable?

## Verdict counts

| Verdict | Count | Notes |
|---|---|---|
| **LANDED-CLEAN** | bulk of the ledger | Wired + asserted by the 419-test suite and/or confirmed in the driven pass. |
| **LANDED-ROUGH** (works, below bar) | 1 | Targeting overlay dense at 915×412 (pre-existing owner flag). |
| **BROKEN** | 0 | No spec/engine-intent violation, soft-lock, page scroll, occluded caption, or input-trap found in the app. |
| **NOT-BUILT** | 0 small closures found in scope | The unbuilt items are LARGE & deferred by decision (tutorial, sound/juice, native pkg) — reported, not built. |
| **fixed this pass** | 1 | Z1: orphaned DropBand + dead `suppressDrop` plumbing removed (dead-code cleanup). |
| **DEVICE-ONLY** | see list | Genuinely need a real phone (touch-latency feel, battery-saver reduced motion, real Android Chrome). |
| **flagged-for-owner** | see list | Deliberate open decisions where the spec is silent — not the auditor's to choose. |

**Headline:** the landscape build is **clean under a demanding driven pass** — 5 full games across both
profiles and 5 seeds finished with **zero** page-scroll / console-error / soft-lock / unhandled-phase /
stuck-bot events. The single code change this pass was removing dead code, not fixing a break. The real
launch blockers remain the *deferred-by-decision* items (no stable host, no native package, no tutorial/
sound, never-run-on-a-real-phone), unchanged from STATUS.

---

## Part A — code-drift findings (full sweep) with verdicts

| # | Finding | File | Verdict | Evidence / disposition |
|---|---------|------|---------|------------------------|
| **Z1** | `DropBand` (the P3 thumb-sized drop band) built but **never mounted**; `suppressDrop` threaded through BankTray + GroupRow/GhostSlot but passed by no caller (always undefined); `LAYERS.dropBand` used only by DropBand. | `components/DropBand.tsx`, `BankTray.tsx`, `BoardParts.tsx`, `tokens.ts` | **LANDED-CLEAN (promise met elsewhere) → dead code FIXED** | The P3 promise ("a legal property/MAKAAN is practically unmissable by drag") is delivered at HEAD by **reveal-on-drag ghost slots + near-miss forgiveness (unique eligible zone within 120px) + fling-to-commit** in `useDragController`. Proven live (`probe-place`): a real drag places both an existing-group extension **and** a new-colour first property. DropBand was redundant. **Removed** — commit `87f5f07`. |
| **Z2** | `badgeFloor` value-legibility feature is a **no-op in normal play**: `BADGE_FLOOR_DEFAULT = false`; only `?badgeFloor=1` (capture harness) turns it on. | `design/badgeFloor.ts:34`, `CardFace.tsx` | **flagged-for-owner** | This is a *deliberate, documented* open decision (DECISIONS J3: default OFF shipped, owner to pick from the A/B stills). The small numerals do NOT clear the 10-device-px floor in normal play (measured ~7.3px on the wheel). Not drift — an owner call. See "flagged-for-owner". |
| **Z3** | `HandoffOverlay` + the whole pass-and-play handoff path is **unreachable**: it mounts only when `handoffSeat !== null`, set only when `humanCount > 1`, but the only UI dealer (`Home.deal`) always builds one human. | `Table.tsx:361`, `store.ts:99`, `Home.tsx` | **LANDED-CLEAN (intentional) — note only** | Pass-and-play is a *specced* feature (BUILD_SPEC §10) currently not exposed by the solo-focused landscape Home. The code is correct and unit-tested (`store.test.ts`). Deleting it would drop a specced capability on a silent-spec point → **not touched**; flagged for the owner to decide (expose vs remove). |
| **Z4** | `MOTION` motion-token object exported but **never imported** (comment: "consumed by the fx layer in M4c"). | `tokens.ts:122` | **NOT-BUILT (M4c, deferred) — note only** | Forward-declared config for the deferred M4c motion layer; components use `design/motion.ts` today. Harmless; left as a documented placeholder for the deferred milestone. |
| **Z5** | `cardBackUrl()` dead — superseded by `cardBackVariantUrl()` (what `CardBack` calls). | `plates.ts:99` | **note only (minor)** | Redundant helper; calling it would pin the full 600px bitmap (the bug the variant version fixed). Low-risk cleanup candidate; left this pass to keep the fix commit tight. |
| **Z6** | `actionInfo()` exported, called nowhere. | `cardData.ts:68` | **note only (minor)** | Dead helper. Cleanup candidate. |
| **Z7** | `completeSetCount()` exported, used only in tests. | `sets.ts:49` | **LANDED-CLEAN** | `distinctCompleteColorCount` is the runtime path; `completeSetCount` is a test helper. Not drift. |
| **Z8** | `[scroll-guard]` `console.warn` can fire on the **dev** `#/autostart` route if a profile overflows. | `App.tsx:56` | **LANDED-CLEAN (dev-only)** | Inside `AutoStartTable` (a capture route), never `#/play`. Won't reach a player. The driven pass saw **no** scroll overflow on either profile, so it did not fire. |

Cleared as *not* drift after tracing: `chargeStandsByLifo` (a deliberate parity-proof kept for the test),
`DEVICE_PROFILES`/`profileById` (consumed by capture scripts), and every `pointerEvents:'none'` gauge
layer (Ticker, TableBand, StageSpotlight, StageCaption, HandWheel cards) — the interactive container sits
above/around them, so no handler is trapped under a scrim.

---

## Part B — driven-browser pass results

### B1 · Full-game invariant sweep (`audit-z.mjs`) — **0 issues**

5 full solo games, both profiles, seeds 7/13/99/7/21, capture-paused so no beat races the driver:

| Assertion (every state, every turn) | Result |
|---|---|
| Page never scrolls (document overflow x/y ≤ 1px) | **PASS** — 0 overflow events across all 5 games |
| No `console.error` / `pageerror` | **PASS** — 0 |
| No soft-lock / unhandled phase / stuck bot (guarded) | **PASS** — all 5 reached a real win |
| Real property-placement drags commit when the drag starts on the right card | **PASS** — see B2 |

The shell is *structurally* incapable of page scroll (`App` root: `100dvh`, `overflow:hidden`,
`overscroll-behavior:none`, `touch-action:manipulation`), and the driven pass confirms it holds in play.

### B2 · Placement drag (the DropBand case, `probe-place.mjs`)

Careful real lift→drag→drop at `tall-915x412`, seed 7:

| Card | Target | Result |
|---|---|---|
| `prop_jaipur_1` (extends existing jaipur group) | `set:jaipur` (MiniGroup) | **COMMITTED** |
| `prop_puraniDilli_1` (first of a NEW colour) | `set:puraniDilli` (ghost slot, reveals on drag) | **COMMITTED** |
| `prop_mumbai_1` | — | grab landed on the overlapping neighbour (`set:puraniDilli` appeared, not `set:mumbai`): a **harness aiming artifact on the fanned wheel**, not an app fault — a human aims at the card's exposed sliver. |

Conclusion: **placing a property by drag works**, including the first property of a new colour (the exact
case DropBand was written to cushion). The set drop zones correctly *reveal on drag* (glow-on-lift) and
the drop hit-test / near-miss / fling commit them.

### B3 · Overlay dismissal (input-trap check)

Bank inspect driven live in the session browser: tray tap → BankView opens (`— bank`, ✕ present) → ✕ tap
→ closed; document overflow x/y = 0 throughout. BankView carries backdrop-tap **and** ✕ **and** Escape
with internal `stopPropagation` — the consistent `Surface` overlay pattern shared by targeting, payment,
table-view, pause, book. **No input-trap found.**

---

## Part C — promise ledger (grouped; verdict by lens)

The full promise extract (spec laws A1–A13 / L1–L6 / drag-inspect contract / zone rules / crispness law /
real-cards law / caption rule / auto-end v2 / payment freedom / targeting reference / orientation shell,
plus 129 DECISIONS "ships" claims) was built and cross-checked. Rather than fabricate 180 individual
"I drove this" claims, each group states its **verification method** honestly.

| Group (source) | Verdict | How verified |
|---|---|---|
| **Engine rules & edge cases** (§4–§8, 20 named edges, interrupts/NAHI parity, payment roster & overpay, KABZA/MAKAAN/HAVELI, win = 3 distinct sets, seeded RNG) | **LANDED-CLEAN** | CODE + the 76 engine / 14 bot tests that assert each; `pnpm simulate` gate (0 invariant violations). Engine + bots are byte-identical this pass (engine findings are FLAGS, never edits — none found). |
| **Real-cards law (G4)** — every card via CardFace/CardBack; MID/CHIP branches gone | **LANDED-CLEAN** | CODE (no MID/CHIP branch remains) + CardFace/plates tests + the driven stills. |
| **Crispness law (K5)** — ScaledCard upscales via CSS `zoom`, transform only for downscale | **LANDED-CLEAN** | CODE + `plateVariants`/`badgeFloor` tests + stills. |
| **Drag/inspect contract (G1/K1)** — tap = inspect, drag = only commit path; retargetable carry; near-miss/fling; reduced-motion snap | **LANDED-CLEAN** | CODE (`useDragController`, `dragPhysics`) + 23 dragPhysics + 36 interaction tests + **driven placement** (B2). |
| **Zone rules / orientation shell (§14)** — rotate gate over unmounted game, MyTurn/Spectate focus-follows-turn, `resolveMyTurn`/`resolveSpectate`, wheel full-width, State-C overlays landscape + dismissable | **LANDED-CLEAN** | CODE (`landscapeLayout`, `App`, `orientation`) + landscapeLayout/orientation tests + **driven pass** (no scroll, both profiles, overlays dismiss). |
| **Caption rule (R2)** — a bot's play reads BESIDE the spotlit card, never behind | **LANDED-CLEAN** | CODE (`StageCaption`/`StageSpotlight` on the LAYERS scale, `stage` > `ticker`) + tokens ordering test + landscape-4 `bot_turn_captioned` clip. |
| **Payment freedom (R4)** — every payable offered (money, banked actions, properties), banked action shown by default, strategic overpay first-class, wildcards never offered | **LANDED-CLEAN** | CODE (`paymentModel`) + 15 paymentModel + PaymentSheet tests; the driven pass resolved real charges. |
| **Targeting reference (R5)** — split with read-only My-Sets pane default-open; hand parked (LANDSCAPE-3 M2) | **LANDED-ROUGH** at 915×412 | CODE + TargetingOverlay tests. **Below-bar note:** dense at the widest profile (chips fill the width, reference pane narrow) — pre-existing owner flag (landscape-4). Functional & readable; a layout-comfort call. |
| **Auto-end v2 (K3)** — turn token owns end (~2.5s drain, pausable/tappable); Declare on the token; centre button gone | **LANDED-CLEAN** | CODE + 7 TurnToken tests + stills. |
| **Bank public (R3)** — tap tray → real-face grid; opponent bank in their zoom | **LANDED-CLEAN** | CODE + 3 BankView tests + **live open/dismiss** (B3). |
| **Munshi (R6/Q2)** — offline, 3 uses, facts-based advice from the shared brain; portrait medallion + fallback | **LANDED-CLEAN** | CODE (`composeMunshiAdvice`, `MunshiChip`) + 9 munshiAdvice + munshi tests. |
| **Home + Book two-pane (R7); in-game nav / pause (P8)** | **LANDED-CLEAN** | CODE + App/Book routing + captures. |
| **Reduced motion (L6/Q3)** — first-class, `?hud=1` red banner, every ease collapses instant | **LANDED-CLEAN (emulated)** / **DEVICE-ONLY (battery-saver)** | CODE + FocusTransition tests + `reduced-915x412` profile. *Real battery-saver-forced* reduced motion on a phone is device-only. |
| **Deferred M4c motion/juice/sound** (stamp-slam, FULL-ribbon, commit/received-card travel, overlay open/close ease, wheel peek, Munshi arrow, sound + haptics) | **NOT-BUILT (deferred by decision)** | `M4C_MOTION_BACKLOG`. None are bugs; teleport-vs-travel gaps here are the *documented* M4c scope, reported not "fixed". |

---

## Part D — DEVICE-ONLY (the owner's phone-day checklist)

These genuinely need a real Android phone; the auditor did **not** fake-verify them.

1. **Touch-latency / drag feel** — the spring/magnet/fling tuning is provable in maths (`dragPhysics`
   tests) but the *feel* (does a place land where the thumb expects, first try, on glass) is device-only.
   Watch specifically the **first property of a new colour** (ghost slot reveals on lift) and a MAKAAN
   onto a complete set.
2. **Battery-saver-forced reduced motion** — confirm the `?hud=1` red banner shows and every animation
   is an instant cut when the phone forces reduced motion (not just the emulated profile).
3. **Real Android Chrome shell** — the rotate gate, the "Go fullscreen" → `orientation.lock('landscape')`
   best-effort, the URL-bar show/hide vs the `100dvh` no-scroll guarantee, and the safe-area insets on a
   notched device.
4. **Wheel grab on glass at 11–12 cards** — the fanned cards overlap; confirm a thumb reliably grabs the
   *intended* card by its exposed sliver (the harness artifact in B2 is a reminder this is worth a look).
5. **Legibility at real DPR** — the value-badge numerals (see Z2) and set-name banners on the actual
   panel, not an emulated deviceScaleFactor.

## Part E — flagged-for-owner (ranked by how much it blocks a real launch)

1. **No stable link a friend can open** — `pnpm phone` mints an ephemeral tunnel that dies with the
   terminal. `vite build` → static host is the fastest real-launch path. *(STATUS thread 1 — biggest.)*
2. **No native package (M5)** — Capacitor → signed AAB → Play. The "proper" launch. *(STATUS thread 2.)*
3. **Never run on a real phone** — everything to date is emulated profiles + one tunnel curl. *(thread 3.)*
4. **No onboarding + no sound/juice (M4 gate + M4c)** — a cold first-timer leans entirely on the Munshi
   and the Book; the M4 spec gate (tutorial + Lighthouse ≥90) is unmet. *(thread 4.)*
5. **Value-badge legibility floor (Z2)** — `badgeFloor` ships OFF; the wheel numerals sit under the
   10-device-px bar. Owner to pick ON/OFF from the A/B stills, ideally judged on a real panel.
6. **Targeting overlay density at 915×412 (LANDED-ROUGH)** — functional but tight; a layout-comfort call.
7. **Pass-and-play exposure (Z3)** — the handoff engine exists but Home only deals solo. Expose it, or
   remove the dead path — an owner decision on a silent-spec point.

## Part F — what this pass did NOT do (scope honesty)

- **No engine/bots edits** — `packages/engine` + `packages/bots` are byte-identical at HEAD. No
  engine-level finding arose; had one, it would be a P0 *flag*, not an edit.
- **No new features / no design inventions** — the only change is dead-code removal (Z1). Where the spec
  is silent and judgment was needed (Z2 badge floor, Z3 pass-and-play, targeting density), the auditor
  **flagged for the owner** rather than choosing.
- **No large NOT-BUILT item was built** — tutorial, sound/juice, native package, stable host all remain
  deferred-by-decision and are reported, not started.
