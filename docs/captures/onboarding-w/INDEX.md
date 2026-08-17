# W — Onboarding + Orientation rebuild (first-player pass) — evidence

The owner tested the RELEASE-1 preview on an iPhone and rejected two things, both corrections of the
earlier SPEC (not the implementation). This pass rebuilds them to the correct design. Every claim below is
backed by a reproducible test (the honest evidence in a client-only game with no real device on hand — the
same emulated-profile + engine-replay approach the earlier passes used).

## W1 — landscape only, done properly (supersedes U2)

- **The rotate screen + state-preserving rotate:** `apps/mobile/src/components/RotateScreen.test.tsx`
  - portrait shows ONE full-screen rotate invitation instead of any real screen, and only in portrait;
  - a game in progress, rotated portrait→landscape, returns to the **exact same state object** (nothing
    reset — the state lives in the store, not the tree).
- Portrait board + `PortraitBanner` removed; Board/Home/Table portrait branches deleted.

## W3 — landscape fit, re-verified after W1

- **Zone-height tables per profile + the locking test:** `W3_LANDSCAPE_FIT.md` +
  `apps/mobile/src/game/landscapeFitW3.test.ts`. iPhone 12 (844×390) and iPhone SE (667×375) landscape,
  WITH chrome + insets: scale 1.0, rows tile the box exactly (no scroll / no dead zone), and the real
  upright hand card fits INSIDE its wheel band (an 11-card hand is never clipped) — on every profile.

## W2 — just-in-time contextual onboarding (replaces the U3 watch demo)

- **Trigger predicates (first-availability per mechanic):** `apps/mobile/src/game/onboarding.test.ts`.
- **Teach-once persistence + Show/Reset tips:** `apps/mobile/src/shell/tips.test.ts`.
- **The controller — teach-once-in-session, clear-on-act, two-dismissals-go-quiet, silent when disabled:**
  `apps/mobile/src/game/useCoachMark.test.tsx`.
- **Fires at the right moment in a REAL game + never blocks legalActions:**
  `apps/mobile/src/game/onboardingLive.test.ts` — replays a full engine-legal game and asserts every human
  teaching move is reported available by the trigger the instant before it is played (6+ coach marks:
  place · complete · bank · pay · nahi · declare … through to a real declared SAUDA); a bot turn surfaces
  no coach.
- **The coach card + Book jump/return keeps the game intact:** `apps/mobile/src/components/CoachMark.test.tsx`
  — a coach appears in a real dealt game; its Niyam link opens the Book chapter over the game and closing
  returns to the **same state object**.

## Reproduce

```
pnpm --filter @sauda/mobile test -- --run RotateScreen landscapeFitW3 onboarding onboardingLive useCoachMark CoachMark tips
```

`pnpm gate` is green at every W commit; `packages/engine` + `packages/bots` are byte-identical to origin.
Tests **486 → 517**.
EOF
