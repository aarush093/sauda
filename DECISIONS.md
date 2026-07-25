# DECISIONS

One line per rules interpretation, deviation, or engineering choice worth remembering.

## M0 — Scaffold

- `DEFAULT_RULES` (§7) lives in `packages/engine/src/rules.ts` (config), kept separate from `theme.ts` (display strings). [approved]
- M0 commit uses the `chore:` prefix (tooling-heavy scaffold) rather than `feat(engine):`. [approved]
- Structural identity (`SET_IDS`, `ACTION_KINDS`) lives in `types.ts`, not `theme.ts`; `theme.ts` supplies display values keyed by those structural keys. This makes card IDs theme-independent by construction.
- Card IDs use the shape `<category>_<structuralKey>_<index>` (e.g. `prop_mumbai_0`, `action_kabza_1`) and are derived only from structural keys — never from display names — so a `theme.ts` edit cannot corrupt a persisted save (saves land in M4).
- The id-independence test forbids any human-facing display string from appearing inside a card ID, *except* strings that (ignoring case/whitespace) are identical to a structural key (e.g. set label "Mumbai" == key `mumbai`, action name "Kabza" == kind `kabza`). The structural key is the sanctioned ID source; every other display string is forbidden.
- The IP guard scans the **whole repo** (so `apps/`, `tools/`, `store/` listing copy are covered automatically as they are added), with an allowlist of exactly two files that legitimately quote the banned terms: `CONTRIBUTING.md` and `docs/BUILD_SPEC.md`. Banned terms are assembled from string fragments so the guard file itself contains no banned literal.
- Toolchain pinned for reproducibility: `packageManager: pnpm@11.17.0`, `engines.node >=24.15.0 <25`, `.nvmrc = 24.15.0`.
- TypeScript strictness hardened beyond `strict`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`, `isolatedModules`.
- The green-before-advancing script is named `pnpm run verify` (not `ci`): `pnpm ci` collides with pnpm's built-in clean-install command and would silently reinstall instead of running the gate.

## M1 — Engine

### Interrupt stack / NAHI CHALEGA
- The interrupt stack uses **one frame per charge**; NAHI CHALEGA cards accumulate in a `nahiChain` inside that frame and the `responder` flips each time. The charge **stands iff `nahiChain.length` is even**, and is cancelled iff odd. This *parity* model is a deliberate simplification of the spec's literal last-in-first-out NAHI stack (§5): unwinding a LIFO stack of cancels-of-cancels is exactly a parity toggle, so counting is equivalent and far easier to explain. A test (`interrupts.test.ts`) proves parity ≡ manual LIFO resolution for chain depths 0–4.
- Multi-target charges (SHAGUN, duo KIRAYA) push **one independent frame per opponent** (§5: "each target resolves independently — one player's NAHI CHALEGA only protects that player").

### Paying with buildings (spec gap — decided explicitly)
- **MAKAAN/HAVELI on a set CAN be handed over as payment.** They sit on the table with a face value (MAKAAN ₹3, HAVELI ₹4), and §4.5 says you pay with cards on the table, so they are payable. Paying with a building **does not break the set** — buildings are not counted toward set completion — so the set stays *complete but stripped* of its rent bonus. This is distinct from paying with a *property*, which can break the set and orphan its buildings (§4.5 last bullet). Both paths are tested in `payment.test.ts`.

### Payment API asymmetry (deliberate exception to "legalActions is the single source of truth")
- For payment, `legalActions` returns a **single `RESPOND_PAY` template** (amount owed + the list of payable card IDs), **not** the enumerated set of valid subsets — subset enumeration is exponential in table size. This is the one place a caller can submit an action that was never in a `legalActions` list, so two things follow:
  1. `reduce` **validates `RESPOND_PAY` exhaustively and defensively**, with a distinct `RuleViolation` code per failure mode (ANY-wildcard included, card not on debtor's table, underpay when able, partial-pay must be pay-all when table < owed).
  2. A shared, tested helper **`suggestPayment(state, request, strategy)`** is the one canonical way to *pick* a selection. Bots consume it in M2; the M3 UI offers it as "auto-pay". Callers never re-implement §4.5.

### Overpay policy — legality permissive, strategy minimal
- `validatePayment` is **permissive**: any selection worth ≥ the debt is legal (pay-all when the table is short). The rules don't require minimality, and checking it is a subset-sum problem that is expensive and hard to explain, so the engine does not invent that constraint.
- **`suggestPayment` always minimises overpay** — voluntary overpay is legal but never what a bot should choose. A test asserts bots never overpay when an exact or cheaper combination exists. (M3 UI will show a live "overpaying by ₹N" warning so voluntary overpay is always deliberate.)

### Implementation choices
- **One immutable card registry + IDs-in-zones.** `GameState.cards` holds all 106 cards once; every zone stores only card IDs. Card conservation is then a cheap set comparison (`invariants.checkInvariants`).
- **`reduce` clones-then-mutates.** Each call deep-clones the mutable state, mutates the clone, and returns it (the card registry is shared, not copied). Chosen for readability over threading immutable updates through every zone; it also can't alias the caller's state.
- **Source action cards are discarded the instant they are played.** You spent the card whether or not it is later cancelled, and it never returns to a hand. So an interrupt frame tracks only the NAHI cards (`nahiChain`) and wildcards awaiting placement (`pendingReceive`) — which also stops a single SHAGUN card being double-counted across its per-opponent frames.
- **`reduce` takes no actor id.** The actor is implied by state: turn actions are the current player's; responses are the open interrupt's `responder` (that is exactly how off-turn NAHI CHALEGA works).
- **KIRAYA is bankable** (treated as an action-type card for §4.4 "bank any money or action card").
- **Rearranging a wildcard out of a complete set relocates its buildings** (§4.5's orphan rule applied generally, not only during payment).
- **Multi-target charges push one frame per opponent** and resolve top-of-stack first; sibling order is deterministic (reverse of push order).
