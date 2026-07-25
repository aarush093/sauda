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
