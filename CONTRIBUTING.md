# SAUDA

An original property card game (set-collection + take-that genre) for Android and web.
**Full specification: `docs/BUILD_SPEC.md` — read it completely before starting any milestone.**

## Never violate

- **No third-party IP.** No Hasbro / Monopoly names, card names, rulebook wording, or visual trade dress anywhere — code, comments, tests, commits, or store listing. See spec §2.
- **All theme strings live in `packages/engine/src/theme.ts` only.** A rebrand must be one file edit.
- **No `Math.random` in the engine.** Seeded RNG only — same seed must reproduce the same game.
- **Never weaken or delete a test to make it pass.** Fix the code instead.
- **Milestones in order (M0 → M6).** Typecheck and tests must be green before advancing.
- If a rule seems ambiguous, implement the most defensible reading and log it in `DECISIONS.md`.

## Commands

```bash
pnpm -r typecheck && pnpm -r test    # must be green before any milestone is "done"
pnpm play                            # CLI game, human vs bots
pnpm simulate --games 1000           # bot strength + invariant harness
```

## Readability contract (standing directive — applies to ALL code, every milestone)

This codebase will be explained line-by-line to technical recruiters in placement interviews.
Code that works but that the author cannot explain is worse than slightly longer code that they can.
**Optimise for the author's comprehension, not cleverness or line-count. Never trade away correctness
or algorithmic efficiency — trade away only cleverness.** When two correct approaches exist, pick the
one that is fastest to explain.

1. **No clever one-liners.** No nested ternaries, no chained `.reduce()` where a plain `for` loop reads clearer, no dense functional pipelines just to save lines. If a junior dev couldn't read it aloud and understand it, expand it.
2. **Comment the WHY.** Every non-obvious function gets a short comment stating why it exists and what rule it implements, referencing the spec section — e.g. `// §4.5: payer chooses cards; no change is given`. Any function must be traceable to a rule.
3. **Domain-language names, no abbreviations.** `propertiesInColorGroup` not `pcg`; `remainingDebt` not `d`. Names are documentation.
4. **Small single-job functions with honest names.** `canCompleteSet` does exactly that, nothing else. Prefer several named functions over one big clever one.
5. **No premature abstraction.** No generic framework for one use case, no unused config, no design pattern unless duplication demands it. Concrete and obvious beats flexible and abstract.
6. **Type-level cleverness in check.** Advanced TS generics/conditional types only where they earn their keep (e.g. the `Card` union). Elsewhere, plain readable types.
7. **Teach the tricky bits.** For genuinely tricky code (interrupt stack, NAHI CHALEGA chains, payment resolution), write a 2–4 line plain-English comment block above it explaining the approach as if teaching the author, before the code.
8. **Maintain `EXPLAIN.md`.** For each milestone, 5–8 plain-English bullets covering key design decisions and how the hard parts work — the interview crib sheet. Update at the end of every milestone.

## Working notes

- `DECISIONS.md` — one line per rules interpretation or deviation.
- `PLAYTEST.md` — issues found while self-testing.
- Keep React components under 300 lines; extract instead of growing.
- Conventional commits, one per milestone: `feat(engine): …`
