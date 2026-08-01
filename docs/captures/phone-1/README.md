# PHONE-1 capture pack

Device-emulated evidence for the PHONE-1 pass (owner phone test 1 Aug). All rerunnable.

- **`INDEX.md` + `REST_<profile>.png`** — `pnpm capture:phone`. The P1 proof: the play screen at
  each real portrait profile (360x740 · 360x800 · 384x832 · 412x915 + a reduced-motion variant), with
  the no-scroll assertion (document height == viewport, a scroll attempt leaves scrollTop 0) and the
  live zone heights, which match `resolveZones()` exactly.
- **`shell/`** — `pnpm capture:shell`. The P8 front door + book + nav: `HOME`, `HOME_setup` (KHELO),
  `BOOK_contents`, `BOOK_ch3_properties` (all 10 sets with real card faces + exact rent ladders),
  `BOOK_ch6_actions`, and `PAUSE_sheet` (the in-game home glyph → pause sheet over the frozen game).
- **`interaction/`** — `pnpm capture --viewport=360x740 --out=…`. Mid-game states at a phone size:
  `REST_my_turn` (no void mid-game), `DRAG_money_bank_hot` / `DRAG_wild_two_groups` (the P3 inflated
  drop band — a thumb-sized bank strip / set slot with the one-glow), `BOT_turn_dim`, `MUNSHI_open`.

The three owner-shot layer bugs (P2) are addressed structurally by the `LAYERS` scale + the
transparent-inspect-scrim fix; see `docs/M4B_SPEC_v1.2.md` §PHONE-1 P2 and `DECISIONS.md`.
