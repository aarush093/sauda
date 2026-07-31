# M4B close-out pass (J) — report

Converts the excellence pass's open flags into finished work and puts the game in the owner's hands —
literally, on his Android phone. Judged on measurements, not assertions. All frame/memory numbers at a
**360×740 viewport, deviceScaleFactor 2**, on the late-game `S6_haveli` fixture through `window.__replay`,
under **4× CPU throttle** for the profile. Reruns: `pnpm --filter @sauda/mobile measure --mode=<profile|memory> --out=<dir>`,
`… plates:variants`, `node apps/mobile/scripts/capture-badge-floor.mjs`.

**`packages/engine` + `packages/bots` byte-identical to pass-start `91755c9`** (`git diff --stat 91755c9 HEAD -- packages/engine packages/bots` empty). **Full-size card faces byte-identical** (J3 proof below). No M4c juice, no M4d screens, tokens-only colours.

**Test count: 262 → 277** (engine 76 · bots 14 · tools 15 · mobile **157 → 172**): +7 J2 variant-selection, +8 J3 floor maths. Never below the 262 floor.

---

## J1 — transition jank is PERF, not M4c (excellence flag 3 recategorised, then fixed)

Both flagged transitions breached the **33 ms** core-interaction ceiling in their **worst single frame** (p95 was already fine). Root-caused with per-interaction render tallies (`--mode=profile` now surfaces them), then fixed with allowed levers only (content memo + split-across-frames). Measurements: `before/profile.json`, `after/profile.json`.

**Worst single frame (ms, 4× throttle, S6_haveli):**
| interaction | ceiling | BEFORE | AFTER | fix |
|---|---|---|---|---|
| play-commit → glide | ≤33 | **66** (flagged) / 33.3 measured | **16.8** | `SetCascade` content memo |
| TableView open | ≤33 | **83** (flagged) / 66.6 measured | **16.8** | shell-first progressive reveal |
| TableView close | ≤33 | 16.7 | 16.7 | — |
| active drag / bot beats | ≤33 | 16.8 | 16.8 | (memo also helps) |

**p95 for every interaction stays 16.7–16.8 ms** across all runs — the reliable metric on this dev box (its single-frame `max` noise-floor is ~33 ms even on a provably-idle drag, so `max` is reported per the deterministic wins below, not chased below noise).

**Root cause → fix, with the deterministic proof:**
- **Glide-commit:** the engine rebuilds every `PropertyGroup` identity on each dispatch, so `SetCascade`'s reference memo missed on *every* commit — banking one card re-ran **88** `SetCascade`s (StrictMode-doubled; faces were memoised so plates didn't repaint, but the wrapper reconcile blew the frame). A **content comparator** (compare `cards`/`buildings` ids, not identity) drops commit cascade re-renders **88 → 0**.
- **TableView-open:** all ~10 large (92 px) cards painted in the one frame that also carries the board re-render + backdrop-blur setup (`CardFace` ×16 that frame). Revealing groups **one per frame starting from zero** (frame 1 = shell only) spreads it — open worst frame **66 → 16.8 ms**, deterministic every run.

## J2 — plate memory is ASSET engineering, not M4c (excellence flag 4 recategorised, then fixed)

The source plates are 600×870; a late-game board of 14–92 px cards each still decoded the full ~2 MB bitmap. `scripts/build-plate-variants.mjs` (sharp) derives **160w + 320w** webp tiers of all 45 plates into `assets/plates/variants/<w>/` (sources untouched — variants are build outputs). Faces are drawn at 132 then transform-scaled, so `srcset` can't respond: selection is an explicit hint — `ScaledCard`/`HandWheel`/`CardBack` pass the on-screen width, `plateVariantUrl` picks the smallest tier covering width×DPR (`chooseVariantWidth`, unit-tested), else the source. Measurements: `before/memory.json`, `after/memory.json`.

**Decoded image memory on S6_haveli (DPR 2), method = Σ naturalW×naturalH×4 over distinct decoded bitmaps:**
| | distinct plates | tiers (naturalW → count) | decoded memory |
|---|---|---|---|
| BEFORE | 26 | 600 → 26 | **51.77 MB** |
| AFTER | 26 | 160 → 25, 320 → 1 | **4.11 MB** (−92%, 12.6×) |

No 600 px plate is decoded on the board anymore (incl. `card_back`, which was a third of the post-variant memory until `CardBack` was wired). **Per-tier file sizes:** 160w **319 KB** total (7.1 KB/plate), 320w **1115 KB** total (24.8 KB/plate). Both tiers are byte-preloaded so no mid-game fetch hitch (`plateNetworkFetchesDuringInteractions: []`).

## J3 — value-badge legibility floor: OFF/ON stills for the owner (excellence flag 1)

The wheel badge measured 7.3 device px against the 10 bar and geometry can't reach it. `badgeFloor.ts` adds a scale-aware floor: below the scale where the numerals would drop under 10 device px, the badge grows (anchored at its corner — the map-label pattern) to hold exactly on the floor. **Scaled renders only; the full-size face is byte-identical** — proof: `badge-floor/fullsize_face_floor_off.png` and `…_on.png` hash **equal** (sha256 `c9755c9fddeffe9c`). Ships **OFF** (`BADGE_FLOOR_DEFAULT=false`); `?badgeFloor=1` flips it per page load.

**A/B still index** (`docs/captures/m4b-closeout/badge-floor/INDEX.md`) — same state, `?badgeFloor=1` the only difference:
| Scene | OFF (shipped) | ON (candidate) |
|---|---|---|
| Hand wheel n=7 | `wheel_n7_floor_off.png` | `wheel_n7_floor_on.png` |
| Hand wheel n=11 | `wheel_n11_floor_off.png` | `wheel_n11_floor_on.png` |
| Late-game board cascades + opponent strips | `board_cascade_floor_off.png` | `board_cascade_floor_on.png` |
| Full-size face (byte-identical proof) | `fullsize_face_floor_off.png` | `fullsize_face_floor_on.png` |

The owner's playtest picks; the default is not flipped here. (Trade-off visible in the stills: on the tiniest opponent strips the floored badge grows large relative to the card — inherent to holding 10 device px on a 14 px card.)

## J4 — the game in the owner's hands

**LAN (normal path):** `pnpm dev:lan` (vite --host, pinned 5174) → **`http://172.17.101.233:5174/`** (phone on same wifi). Terminal QR via `pnpm phone`:

```
█▀▀▀▀▀█ ▄▀▄▄ ▄ █▀▀▀▀▀█   scan on the phone, or type the URL.
█ ███ █ ▄█ █▄▄  █ ███ █   Windows firewall will prompt for Node the
█ ▀▀▀ █ █▀ ▄▀▀  █ ▀▀▀ █   first time — ALLOW (Private networks).
▀▀▀▀▀▀▀ █▄▀ █▄▀ ▀▀▀▀▀▀▀   (full QR printed by `pnpm phone`)
```

**USB fallback** (wifi isolates clients): `adb reverse tcp:5174 tcp:5174`, then open **`http://localhost:5174/`** on the phone. Both paths documented in `docs/PHONE_PLAYTEST.md`.

**Off-localhost verified safe from code:** `__replay`/`__saudaCapturePaused`/autostart are hash-based, in-page, `DEV`-gated; plate URLs are root-relative (`import.meta.glob ?url`); vite `base` is `/`; grep finds **no** absolute host string in `apps/mobile/src`.

**Touch audit result:** clean, one fix. All gestures already use pointer events (`useFanGesture`/`useHandDrag` + `setPointerCapture`); the wheel/drag layers set `touch-action:none`; `contextmenu` is suppressed on every draggable; there are **no** hover-only handlers (the lone `:hover` is a mouse-only button polish, harmless on touch). The single cursor-only sibling of the H1a find — my **own** group cascades were tap-to-expand via `cursor`+`title` only — got the same visible **⤢** affordance opponents got (`MiniGroup expandHint`).

## J5 — closures (docs)

- Corrected the imprecise "steals auto-place" note in `DECISIONS.md` G6: `reduce.ts moveCardToCreditor` auto-places a stolen *property* but opens a placement CHOICE (`awaitingReceive`) for a stolen *wildcard* — the UI's received-flow handles it.
- `DECISIONS.md`: J1 (perf) and J2 (assets) recategorisations recorded, one entry each.
- `DECISIONS.md`: relevance-weighted bot pacing recorded as **IDENTIFIED and PARKED** pending the owner's phone-playtest verdict on the current H5 pacing.

---

## Flags (all owner-decisions, no open engineering)
1. **J3 badge floor — owner to pick OFF/ON** from the A/B stills. Default OFF shipped; ON is a one-line flip of `BADGE_FLOOR_DEFAULT`. The full-size face is identical either way.
2. **On-board cascade SIZE (H6) — still open**, owner playtest decides. It bounds the wheel's vertical budget, so it's a joint call with the wheel; unchanged this pass.
3. **Bot pacing — the H5 baseline pends the owner's on-device verdict.** Relevance-weighted pacing (full beats only for plays targeting the human) is the parked next lever if turns still drag on the phone.
