# HAND + INFO REDESIGN (S) — capture pack

Visual proof for the S-pass. Rendered from a dev server on HEAD via Playwright
(`scripts/capture-hand-info-1.mjs` for stills, `capture-hand-info-1-clips.mjs` for
clips). Every game state is driven through the committed `window.__replay` / `__sauda`
dev hooks — the shipped app is unchanged. `deviceScaleFactor: 2` (DPR 2). A capture that
would not render is recorded in `results.json` with its exact error; none failed.

## S1 — the SPREAD (flat upright cards, size-up)

| file | what |
|------|------|
| `spread_n5_915x412.png` · `spread_n8_915x412.png` · `spread_n11_915x412.png` | the spread at n = 5 / 8 / 11 on the wide profile |
| `spread_n5_740x360.png` · `spread_n8_740x360.png` · `spread_n11_740x360.png` | …and on the tightest short-edge profile — every banner + value badge stays uncovered, no clip at n=11 |
| `spread_scrub_915x412.webm` | press-to-slide-up scrub across the spread (each card lifts straight up as the pointer passes) |
| `spread_drag_915x412.webm` | a hand card pressed, lifted out of the band into a drag, carried to a drop zone (real game, seed 7) |

### Measured legibility (rendered rest card, n=11, DPR 2)

| profile | rest card width | banner title device-px (9px face) | value badge device-px (7px face) |
|---------|-----------------|-----------------------------------|----------------------------------|
| 915×412 | **98 px** | **13.4** | **10.4** — clears the 10-device-px H3 floor with the badge-floor toggle OFF |
| 740×360 | **78 px** | 10.6 | 8.3 |

The old wheel rest card was ~69 px (badge ~7.3 device-px, below the floor); the size-up
lifts the 915 profile to 98 px / 10.4 device-px. Numbers measured off the live DOM, not
computed — see `results.json.legibility`.

## S2 — hidden bot cash (redaction)

| file | what |
|------|------|
| `redaction_rail_915x412.png` | MY-TURN board: bot rail chips show the note-stack glyph "▤" + count, never a ₹ total; "You ₹19" (my own total, shown) |
| `redaction_opponent_zoom_915x412.png` | Bot 1 zoom — header "Bank ▤ 4", bank row = 4 face-DOWN card backs, never faces or a total |
| `redaction_my_bank_915x412.png` | MY bank inspect — "You — bank ₹19 Cr" + 5 real faces (₹10/₹2/₹1/₹3/₹3): the asymmetry |
| `redaction_banked_a_note_915x412.png` | SPECTATE — stage caption "B1 · banked a note" + ticker "P1 banked a note" + acting-bot header "Bot 1 ▤ 1" |

Redaction state: `S6_haveli` (seed 7), my turn, bot banks [4, 1, 4]. The "banked a note"
still is a fresh bot banking driven from seed 7 (step 3). Debts stay explicit — the
`redaction_rail` ticker also shows real payment amounts ("P3 paid P0: ₹2 Cr"), the S2 exception.
