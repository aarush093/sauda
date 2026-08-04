# LANDSCAPE-4 N3 — device reality double-check (make the link work before the owner tests)

Verified at HEAD on **2026-08-04**. Two surfaces: the **local** orientation shell (deterministic,
re-runnable) and the **public tunnel** (a point-in-time check on the real URL — the URL rotates every
run by design, so these tunnel stills are evidence of one live session, not a fixed address).

## The live tunnel (this session)

- **Public URL:** `https://flux-named-performed-query.trycloudflare.com`
- **Deep-link:** `https://flux-named-performed-query.trycloudflare.com/#/autostart` (jumps straight into a game)
- **Rotates per run** — every `pnpm phone` mints a fresh quick-tunnel URL and the previous one dies.
  Don't hunt the old one; run `pnpm phone` again and use the fresh URL + QR it prints.

Reachability (curled while live):

| Route | Status |
|-------|--------|
| `/` (Home) | **200** |
| `/#/autostart` (deep-link) | **200** (hash route — SPA serves the same document) |
| `/src/main.tsx` (live dev module) | **200** — confirms the tunnel serves the HEAD dev build, not a stale bundle |
| document `<title>` | `SAUDA` |

## Verdicts (all PASS)

| Check | Where | Verdict | Still |
|-------|-------|---------|-------|
| `?hud=1` shows **orientation + reduced-motion** | tunnel URL, forced reduced motion | **PASS** — HUD reads `orientation: landscape` and `reduced-motion: ON` (the battery-saver state the owner could not otherwise see) | `n3_hud_tunnel_reduced.png` |
| **Portrait → rotate interstitial** | tunnel URL, 412×915 | **PASS** — `[data-rotate-gate]` present + the "Go fullscreen" affordance | `n3_portrait_rotategate_tunnel.png` |
| **Landscape → game directly** | tunnel URL, 915×412 | **PASS** — no rotate gate; the table renders | `n3_landscape_game_tunnel.png` |
| **"Go fullscreen" → orientation lock attempted, failure swallowed** | local (spy) | **PASS** — calls `requestFullscreen`, then `orientation.lock('landscape')`; when the lock rejects it does NOT throw | see `../../landscape-2/` L6 `l6_fullscreen_affordance` |

Local re-run of the full orientation shell (deterministic): `pnpm dev:lan`, then
`pnpm capture:landscape2 --stage=l6` — re-verified green at HEAD (rotate gate, fullscreen affordance,
landscape-enters-game, hud orientation+reduced all PASS).

The on-tunnel stills here were shot with an ad-hoc Playwright pass against the live URL; because the
URL is ephemeral, exact reproduction means running `pnpm phone` for a fresh URL and re-pointing the
probe. The **behaviour** is identical to the committed local L6 proof (the tunnel only proxies the
same dev server).
