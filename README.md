# SAUDA (सौदा)

An original property card game — **set-collection + take-that** genre — for Android and web.
Fully offline, no accounts, no backend. Single human vs AI bots, plus local pass-and-play.

> Full product & rules specification: [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md).
> Engineering guardrails: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Monorepo layout

```
packages/engine/   pure TS rules engine (deterministic, seeded RNG, zero runtime deps beyond zod)
```

More packages (`bots`, `apps/mobile`, `ml`, `tools`, `store`) are added in later milestones.

## Toolchain

Pinned for reproducibility: Node `24.15.0` (`.nvmrc`), pnpm `11.17.0` (`packageManager`).

```bash
pnpm install
pnpm -r typecheck && pnpm -r test   # must be green before advancing a milestone
```

## Guardrails (see CONTRIBUTING.md)

- All player-facing strings live in `packages/engine/src/theme.ts` only — a rebrand is one file edit.
- No `Math.random` in the engine; seeded RNG only (same seed reproduces the same game).
- Card IDs are structural and theme-independent, so a `theme.ts` edit never corrupts a saved game.
- A whole-repo guard test blocks any third-party intellectual-property strings from entering the codebase.
