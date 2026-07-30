# M4B Excellence Pass — capture INDEX

Every MOVING thing is a committed `.webm` CLIP (H0); static states are `.png` stills. All at a
360×740 viewport, deviceScaleFactor 2, driven through the committed `window.__replay` hook.
Clips unfreeze the table so real motion (the 175ms glide, drags, bot beats) plays. Rerun:
`node apps/mobile/scripts/capture-excellence.mjs`.

| File | Kind | Scene | Spec | Commit |
|------|------|-------|------|--------|
| `H3_wheel_n2.png` | still | The hand wheel at n=2 — one card size, readable strips inside the frame. | H3 | _pending_ |
| `H3_wheel_n5.png` | still | The hand wheel at n=5 — one card size, readable strips inside the frame. | H3 | _pending_ |
| `H3_wheel_n7.png` | still | The hand wheel at n=7 — one card size, readable strips inside the frame. | H3 | _pending_ |
| `H3_wheel_n9.png` | still | The hand wheel at n=9 — one card size, readable strips inside the frame. | H3 | _pending_ |
| `H3_wheel_n11.png` | still | The hand wheel at n=11 — one card size, readable strips inside the frame. | H3 | _pending_ |
| `H3_wheel_glide.webm` | clip | The seamless re-spacing glide — a card leaves the hand and the rest glide (175ms) to new even spacing. | G2 · H3 | _pending_ |
| `H3_wheel_scrub_throttle.webm` | clip | Scrubbing an 11-card wheel under 4× CPU throttle — the peek re-targets card by card, no flicker. | G2 · H3 | _pending_ |
| `H2_endturn_header.png` | still | End turn now sits in the my-area header by the bank — the 11-card wheel below spans full width, no card overlapped. | H2b | _pending_ |
| `H1_opponent_expanded.png` | still | An opponent's full board expanded — their sets as large real cards + bank total (tap a row to open). | H1a · G4 | _pending_ |
| `H1_wheel_scrub_11.webm` | clip | The 11-card wheel scrubbed end to end — a finger glides across, each card peeks up under the pointer. | A13 G2 · H1c | _pending_ |
| `H1_drag_to_bank.webm` | clip | A money card dragged from the wheel to the bank — the bank glows HOT, release banks it and the hand glides to re-space. | A10 L3 · H1c | _pending_ |
| `H1_discard_overlay.webm` | clip | The over-the-limit discard overlay end to end — real card faces spread; tapping buries each under the draw pile until the count hits 7 and it dismisses. | G3 · A8/A9 · H1c | _pending_ |
| `H1_bot_turn.webm` | clip | A full bot turn — I end mine, control passes, the bot draws and plays with paced beats (H5), each card held to be seen. | I1 · H5 · H1c | _pending_ |
| `H1_received_stage.png` | still | A received wildcard on centre stage — "Drag it to a glowing set", its two colour-sets (newDelhi · junction) glowing below. | H1b · G6 · C7 | _pending_ |
| `H1_received_flow.webm` | clip | The received-card flow — the wildcard sits on centre stage, legal sets glow, I drag it home to a set (RESPOND_PLACE_RECEIVED). | H1b · G6 · C7 | _pending_ |
| `H2_endturn_early.webm` | clip | On my own turn with plays STILL remaining, End turn is visible in the header and reachable — clicking it ends the turn early (never dead). | H2a | _pending_ |
| `H3_glide_vs_drag.webm` | clip | Glide/drag interplay — a card leaves mid-glide and another is grabbed while the re-spacing is still in flight; no double animation, no hit-target drift. | G2 · H3 | _pending_ |
