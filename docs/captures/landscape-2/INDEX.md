# LANDSCAPE-2 — close-out capture pack INDEX

The verify/prove/clean pass. Clips are real webm MOTION (L2); stills are full frames for the
eyeball audits (L3) and the restored table band (L4). All shot on the landscape device profiles
(deviceProfiles.json) via the committed `window.__replay` hook. A clip that will not render is
listed with its exact error — never replaced by a still.

Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:landscape2` (or `--stage=l4|clips|profiles`).

## Clips (L2 — motion proof)

| Clip | Profile | What it proves |
|------|---------|----------------|
| `bot_turn_captioned.webm` | 915x412 | A full bot turn in SPECTATE — the "Bn · <place>" caption sits BESIDE the played card on stage, never occluded. |
| `money_fling_to_bank.webm` | 915x412 | A money card FLUNG from the wheel into the bank tray — it flies in and the bank total commits. |
| `overpay_owe2_pay_banked3.webm` | 915x412 | I owe Rs2 (a bot plays SHAGUN) and pay with a BANKED Rs3 action card — the meter reads "no change given" (the R4 overpay). |
| `targeting_haath_ki_safai.webm` | 915x412 | HAATH KI SAFAI played on my turn — the targeting split opens with the "Your sets — reference" panel OPEN beside the glowing targets. |
| `transition_myturn_to_spectate_legacy.webm` | 740x360 | The MY-TURN -> SPECTATE transition at the tightest 740x360 profile — the focus flip still reads. |
| `transition_myturn_to_spectate.webm` | 915x412 | MY-TURN -> SPECTATE: I end my turn and focus follows the turn to the acting bot (the split slides in). |
| `transition_spectate_to_myturn.webm` | 915x412 | SPECTATE -> MY-TURN: after the bots finish, focus returns to me and my world fills the screen. |
| `wheel_scrub_landscape.webm` | 915x412 | An 11-card hand wheel scrubbed end to end at full landscape width — the cards PART around the pointer and the one under it MAGNIFIES. |

## Stills (L4 table band · L3 profile audit)

| Still | Proves |
|-------|--------|
| `l3_myturn_800x360.png` | L3 MY-TURN @ 800x360 |
| `l3_myturn_832x384.png` | L3 MY-TURN @ 832x384 |
| `l3_myturn_915x412_reduced.png` | L3 MY-TURN @ 915x412_reduced |
| `l3_spectate_800x360.png` | L3 SPECTATE @ 800x360 |
| `l3_spectate_832x384.png` | L3 SPECTATE @ 832x384 |
| `l3_spectate_915x412_reduced.png` | L3 SPECTATE @ 915x412_reduced |
| `l3_targeting_800x360.png` | L3 targeting split (HAATH KI SAFAI + My-Sets reference) @ 800x360 |
| `l3_targeting_832x384.png` | L3 targeting split (HAATH KI SAFAI + My-Sets reference) @ 832x384 |
| `l3_targeting_915x412_reduced.png` | L3 targeting split (HAATH KI SAFAI + My-Sets reference) @ 915x412_reduced |
| `l4_band_myturn_740x360.png` | L4 table band (draw count + discard top) in MY-TURN @ 740x360 |
| `l4_band_myturn_915x412.png` | L4 table band (draw count + discard top) in MY-TURN @ 915x412 |
| `l4_band_spectate_740x360.png` | L4 table band in SPECTATE @ 740x360 |
| `l4_band_spectate_915x412.png` | L4 table band in SPECTATE @ 915x412 |

