# LANDSCAPE-4 — N1 motion-proof pack INDEX

The "prove it MOVES" pass. Every entry is a real webm MOTION clip, rendered fresh at HEAD via the
committed `window.__replay` dev hooks, on BOTH landscape profiles the owner hands out: the widest
(915x412) and the tightest short edge (740x360). A clip that will not render is listed with its
EXACT error — a still is NEVER substituted for a motion claim (N1 hard rule).

Predecessor: `docs/captures/landscape-2/` already held these six proofs (commit a4d1a8b) — mostly
915x412 with one legacy transition. LANDSCAPE-4 re-renders all six at HEAD on BOTH profiles so the
360px short edge is proven to move, not just sampled as a still. 14/14 rendered; zero render errors.

Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:landscape4` (or `--only=<scene>`).

| Clip | Profile | Duration | What it proves |
|------|---------|----------|----------------|
| `transition_myturn_to_spectate__915x412.webm` | 915x412 | 0:05.56 | MY-TURN -> SPECTATE: I end my turn and focus follows the turn to the acting bot (the split slides in). |
| `transition_myturn_to_spectate__740x360.webm` | 740x360 | 0:05.08 | MY-TURN -> SPECTATE at the tightest short edge — the focus flip still reads. |
| `transition_spectate_to_myturn__915x412.webm` | 915x412 | 0:09.88 | SPECTATE -> MY-TURN: after the bots finish, focus returns to me and my world fills the screen. |
| `transition_spectate_to_myturn__740x360.webm` | 740x360 | 0:09.92 | SPECTATE -> MY-TURN at 740x360 — the return flip after three bot turns. |
| `bot_turn_captioned__915x412.webm` | 915x412 | 0:06.88 | A full bot turn in SPECTATE — the "Bn · <place>" caption sits BESIDE the played card on stage, never occluded. |
| `bot_turn_captioned__740x360.webm` | 740x360 | 0:06.60 | The captioned bot turn at 740x360 — the caption still seats beside the card on the tightest stage. |
| `targeting_haath_ki_safai__915x412.webm` | 915x412 | 0:03.48 | HAATH KI SAFAI played on my turn — the targeting split opens with the "Your sets — reference" panel OPEN beside the glowing targets. |
| `targeting_haath_ki_safai__740x360.webm` | 740x360 | 0:03.68 | HAATH KI SAFAI targeting + My-Sets reference at 740x360. |
| `overpay_owe2_pay_banked3__915x412.webm` | 915x412 | 0:04.84 | I owe Rs2 (a bot plays SHAGUN) and pay with a BANKED Rs3 action card — the meter reads "no change given" (the strategic overpay). |
| `overpay_owe2_pay_banked3__740x360.webm` | 740x360 | 0:04.80 | The owe-Rs2 / pay-banked-Rs3 overpay at 740x360 — the payment sheet + "no change given" meter fit the short edge. |
| `wheel_scrub_landscape__915x412.webm` | 915x412 | 0:05.92 | An 11-card hand wheel scrubbed end to end at full landscape width — the cards PART around the pointer and the one under it MAGNIFIES. |
| `wheel_scrub_landscape__740x360.webm` | 740x360 | 0:06.40 | The wheel scrub (parting + magnify) at 740x360. |
| `money_fling_to_bank__915x412.webm` | 915x412 | 0:03.04 | A money card FLUNG from the wheel into the bank tray — it flies in and the bank total commits. |
| `money_fling_to_bank__740x360.webm` | 740x360 | 0:03.36 | The money fling into the bank at 740x360. |

## Framing note (honest)

These clips share the L2 recorder's geometry: Playwright renders the page at the CSS viewport
(e.g. 915x412) in the top-left of a larger video canvas, so there is dead space to the right/below
the game. The game content is fully legible and the motion is captured end to end — the dead margin
is a recorder artifact, identical to the committed `landscape-2/` pack (same code path), not a layout
bug in the app.
