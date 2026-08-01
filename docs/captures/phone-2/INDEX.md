# PHONE-2 motion-proof capture pack — INDEX

PHONE-1 flag 1: feel cannot be shown with stills. Every entry here is a webm CLIP, rendered on the
real phone device profiles (deviceProfiles.json) via the committed `window.__replay` hook, then
UNFROZEN so real motion plays. The two bot-turn clips are the reduced-motion evidence: the same
turn with motion on and with prefers-reduced-motion forced, side by side.

Rerun: `pnpm dev:lan` in one shell, then `pnpm capture:phone2`.

| Clip | Profile | What it proves |
|------|---------|----------------|
| `fling_money_to_bank.webm` | 412×915 | A money card FLUNG from the wheel into the inflated bank strip — it flies in and the bank total commits. |
| `makaan_build_on_chennai.webm` | 412×915 | A MAKAAN thumb-dropped onto the glowing centre-stage play target — with the complete Chennai set the only build site, release builds the MAKAAN onto Chennai. |
| `wheel_scrub_spread.webm` | 360×740 | An 11-card wheel scrubbed end to end at 360px — the cards PART around the pointer (the wave) and the one under it magnifies, at the tightest width. |
| `near_miss_pulse.webm` | 412×915 | A release that MISSES every zone — the card springs home and the board explains itself: the eligible zones pulse and a ticker hint appears (no silent mystery). |
| `bot_turn_motion_on.webm` | 412×915 | A full bot turn with MOTION ON — I end mine, control passes, the bot draws and plays with the travel/reveal animations and paced beats. |
| `bot_turn_reduced_motion.webm` | 412×915 · reduced | The SAME bot turn with prefers-reduced-motion FORCED — the slides/scales are gone but the comprehension holds and turn beats remain, so it is still followable. Pair this with bot_turn_motion_on. |
| `home_setup_dealin.webm` | 412×915 | The front door in motion — HOME, KHELO opens the setup card, DEAL deals the game in. |

## Static-surface stills (Q2 Munshi layout · Q3 reduced-motion disclosure)

The rebuilt Munshi advice card is static (only the medallion floats), so its layout is a still at
each width — BEFORE: `docs/captures/phone-1/interaction/MUNSHI_open.png`. The Q3 stills show the
two reduced-motion disclosures (the paired bot-turn clips above are the comprehension evidence).

| Still | Size | What it proves |
|-------|------|----------------|
| `MUNSHI_advice_360.png` | 360×740 · reduced | The rebuilt advice card at 360px — medallion · sentence · recommended card, nothing overlapping, above the board badges. |
| `MUNSHI_advice_412.png` | 412×915 · reduced | The rebuilt advice card at 412px — same three-column layout holds at the tall profile. |
| `HUD_reduced_motion_on.png` | 412×915 · reduced | Q3: the dev HUD shows reduced-motion ON as a red banner — the state the owner could not see on his first phone game. |
| `PAUSE_reduced_motion_note.png` | 412×915 · reduced | Q3: the in-game pause sheet carries one quiet permanent line disclosing that reduced motion is active. |

