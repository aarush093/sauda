# SAUDA — M4 Design & Polish Specification (v2 — Deed Card centrepiece)

> **How to use:** replace `docs/M4_DESIGN_SPEC.md` with this file. It supersedes v1 and refines the M4 section of `docs/BUILD_SPEC.md`. Read fully before starting. Work strictly in sub-milestones (§14).
>
> **IP note:** this file is written without banned third-party names and must NOT be added to the ip-guard allowlist. Additional hard rules in §3.6. All game values (₹, rents, set sizes) come from the engine — never from this document's examples and never baked into artwork.

---

## 0. What M4 is (and is not)

M4 turns the neutral M3 app into the finished SAUDA identity, centred on the **Deed Card**: a vintage Indian matchbox-label trading card — aged cream paper, ornate borders, a city scene with a characterful figure, a factory-style footer — carrying live, engine-driven game data. Plus the juice stack, the stamp-slam signature, a shareable Victory Deed, and an honest collection meta.

M4 is presentation, feel, share, and meta only. The engine is untouched; `dispatch === reduce`; every button from `legalActions`; every number from `observe()`. The only engine edit permitted is the data-only set-ink hex update (§2.2).

## 1. Four doctrines

1. **Feedback is the design, not polish.** Every interaction passes through the layered juice stack, built alongside the UI.
2. **Consistency through one rigid template.** Every card = the same zone contract at three sizes. Never a second layout.
3. **Honest design is the positioning.** No ads, energy bars, timers, FOMO, or notification begging. Unlocks by play only.
4. **Art is printed, data is alive.** Decorative art ships as static raster plates; every number, name, and icon that carries game meaning is rendered live by code from engine data. The plate may never contain text or numerals.

## 2. Design tokens — `apps/mobile/src/design/tokens.ts`

### 2.1 Core colours

```ts
export const INK = {
  tableIndigo: '#1B1E42', deepInk: '#14121F',
  cardCream: '#F2E9D2', agedLine: '#C0A24E',
  gold: '#E8B84B',        // money, seals, win — sparingly
  stampRed: '#C6342B',    // stamps, FULL SET row, danger
  lavender: '#B8B4CE', creamBlue: '#C9D4F0',
} as const;
```

### 2.2 Matchbox ink plate — update `SETS` hexes in `theme.ts` (data-only engine edit)

puraniDilli `#8C4A2F` · kashi `#1F7A8C` · jaipur `#C2367E` · kolkata `#D96C2C` · chennai `#C6342B` (shares stampRed deliberately — vintage plates reused inks) · bangalore `#E3A81C` · newDelhi `#2E7D46` · mumbai `#27408B` · junction `#22222A` · utility `#7C8A6E`. Run the full suite after.

### 2.3 City tone table (art direction, used by the prompt template §4.2)

Base cream is constant; each city shifts its **sky/wash tone** and keeps its set ink dominant:

| City | Tone note |
|---|---|
| Mumbai | sea-morning blue wash, monsoon grey hints |
| Purani Dilli | dusk amber, warm sienna dust |
| Kashi | dawn mist teal, diya-flame gold points |
| Jaipur | sandstone pink, bright noon |
| Kolkata | sepia afternoon, tram-wire lines |
| Chennai | coastal warm red, bright shore light |
| Bangalore | chrome yellow with rain-tree green hints |
| New Delhi | leaf green, pale sandstone |
| Junctions | steam-era sepia on ink black |
| Utilities | sage, workshop neutral |

### 2.4 Typography & sizing (unchanged from v1)

Baloo 2 (700, latin+devanagari) display · Karla (400/700) body · IBM Plex Mono (500/700, tabular) numerals. Self-hosted, subset, ≤120 KB. Card widths: FULL `clamp(96px, 26vw, 140px)`, MID 72px, CHIP 44px; ratio 100:145; touch ≥44px; 4px grid.
Motion tokens: spring {380, 26}, press {500, 30}, counter 400ms, deal stagger 60ms, freeze 100ms, shake ≤4px.

## 3. THE CENTREPIECE — the Deed Card

Reference: the approved Mumbai concept (aged label, floral corners, landmark + figure, matchstick rent icons, factory footer, circular seal). We reproduce that exact character with a **two-layer architecture**:

- **Layer A — Art plate (static raster):** the full-bleed vintage painting: paper grain, ornate double border, corner flora, city scene with its figure. Generated per §4. Contains **zero text, zero numerals, zero logos**.
- **Layer B — Live layer (code, SVG/text):** everything that means something: value badge, name + Devanagari, set-count matchstick icons, rent ladder, FULL SET row, factory footer line, SAUDA PRESS seal, corner value chip. Rendered by `CardFace` from engine data in the shared vintage type styles, identical across all 106 cards.

This is what makes "exactly this look" shippable: the plate gives the soul; the live layer guarantees rigorous board-game-grade consistency, correct values forever, and crisp text at every size.

### 3.1 Zone contract (fractions of card height H; the plate prompt enforces the same grid)

1. **0–0.06 H — outer frame:** plate's painted border; live layer adds nothing.
2. **0.06–0.20 H — title zone (plate keeps calm):** live value badge top-left (`₹N` mono in a cream disc, set-ink ring); live name centred — Baloo 2 caps + Devanagari sublabel (creamBlue); optional small `(FORT AREA)`-style sub-line = the property's street tagline from `theme.ts` (new presentation-only field, e.g. Mumbai → "MARINE DRIVE").
3. **0.20–0.52 H — hero scene:** plate's landmark + figure. Live layer adds nothing.
4. **0.52–0.84 H — ledger zone (plate keeps visually calm; live layer paints a 78%-opacity cream scrim card with agedLine edge for guaranteed readability):**
   - caption, our wording only: `(deeds held of this colour)` — small Karla italic;
   - **rent ladder:** one row per count — **matchstick-card icon** (live SVG: tiny matchbox-card with red match-tip corner, numeral inside, stacked ×N), dotted agedLine leader, `₹N Cr` right-aligned mono;
   - final row = **FULL SET**, label + value in stampRed bold, one size larger;
   - set pips are expressed by the ladder itself here; MID/CHIP sizes surface pips explicitly (§3.4).
5. **0.84–0.96 H — factory footer band (live):** two-line pastiche in press caps over a set-ink band: line 1 = the city's fictional works name (§3.5); line 2 = `DAMP PROOF · SAFETY DEEDS · EST. 19XX` split left/centre/right, with `VALID SINCE 19XX` and `PROPERTY OF <CITY>` as the outer micro-labels. All fictional, generated from the pattern — never copied from real labels.
6. **Seal + corner chip (live):** circular **SAUDA PRESS** seal (gold line-stamp, सौ monogram) overlapping footer-right; gold corner value chip `₹N` bottom-right so fanned cards always read.

### 3.2 Other kinds, same deed language

- **Action cards:** plate = poster-style vignette per action (§4.3 table); live layer = red "ACTION" ribbon, the desi name as a skewed −8° stamp outline, English descriptor, `or bank as ₹N`, footer `SAUDA ACTION PRESS`.
- **Kiraya:** split two-ink band; wild kiraya = ten-ink ring; descriptor `All rivals pay` / `One rival pays`.
- **Wildcards:** two-ink split banner; body lists both options as `MUMBAI ●● SET ₹8` rows. ANY: ten-colour strip, `Counts for any colour · ₹0 · cannot pay`.
- **Money:** vintage **hundi-note** styling — cream, engraved-style double gold rule (live SVG guilloche lines), giant `₹N` centre, corner chips; ₹10 gets a full gold band. No plate needed (pure live layer).
- **Card back (default):** indigo matchbox label, double cream border, gold सौदा monogram, "SAUDA".

### 3.3 The currency mark

All values render as **₹ … Cr** exactly as the engine reports. The double-barred letter mark used by the classic game remains banned everywhere, including generated art (enforced by the no-text rule + QC).

### 3.4 Three sizes — graceful degradation, never a second layout

- **FULL:** both layers, everything above.
- **MID (your table):** live-only — set-ink band + set label, pips (●×size with held count filled), `SET ₹N` red, corner value. No plate.
- **CHIP (rivals, log):** set-ink rect, initial/mini glyph, `k/n` gold mono; complete = gold ring + ✓.

Render test: every card id × 3 sizes, no overflow (longest names included).

### 3.5 Factory-footer generator

`theme.ts` gains a presentation-only `works` field per set, following the pattern `<CITY EPITHET> DEEDS & <TRADE>WORKS, <LOCALITY>`: e.g. Mumbai → `BOMBAY LAND DEEDS & MATCHWORKS, FORT` · Kashi → `KASHI GHAT DEEDS & LAMPWORKS, DASHASHWAMEDH` · Bangalore → `GARDEN CITY DEEDS & CIRCUITWORKS, MG ROAD` · Junctions → `GRAND TRUNK DEEDS & LOCOWORKS`. EST years vary 1885–1935. All lines are fictional and original; a copy-review grep in M4d confirms none match real factory names.

### 3.6 Hard IP rules for this system

No banned names anywhere including asset filenames and prompts · no double-barred currency mark · no official rule-card wording (our caption only) · no real brand seals or factory names · no real-person likenesses in figures · plates contain no text of any kind.

## 4. Art-plate pipeline (the consistency machine)

Plates are generated by an image model **outside this repo** (owner's workflow), using the locked template below, then QC'd and dropped into `apps/mobile/src/assets/plates/{cardId}.webp`. Everything else is built in code and never blocks on art (§4.5 fallback).

### 4.1 Inventory

28 property plates (one per property — each city consistent, each card quirky) · 10 action plates (per kind) · optional 1 shared wildcard backdrop · money/kiraya/wild = live-layer only. **Total ≈ 38–40 plates.**

### 4.2 Locked prompt template (only bracketed variables may change)

> Vintage Indian matchbox label trading-card artwork, early-1900s lithograph print, aged cream paper (#F2E9D2) with printed grain, ornate double border with [CITY FLORA] corner motifs, dominant accent ink [SET HEX] with [TONE NOTE from §2.3], limited palette (cream, [SET HEX], gold #E8B84B, soft vermillion), flat printed shading, central scene: [LANDMARK] with [FIGURE/OBJECT], composition contract: top 20% calm banner space, 52–84% height column visually calm and low-detail, bottom 14% quiet band, portrait 100:145, high-detail lithograph. Absolutely NO text, NO letters, NO numerals, NO logos, NO watermarks, NO modern objects.

Negative prompt: `text, letters, numbers, typography, watermark, logo, signature, modern vehicles, photorealism`.

### 4.3 Per-card art table (landmark + quirk; flora per city in brackets)

**Mumbai** [marigold]: Marine Drive — night necklace lights + Koli fisherwoman · Altamount Rd — art-deco tower + vintage motorcar.
**Purani Dilli** [rose]: Chandni Chowk — domes + jalebi-wala mid-swirl · Chawri Bazaar — paper-kite seller.
**Kashi** [lotus]: Assi Ghat — boat + floating diyas · Tulsi Ghat — temple bell + wrestler's akhara club · Dashashwamedh — pandit with grand aarti lamp.
**Jaipur** [bougainvillea]: Hawa Mahal Rd — jharokha facade + pigeon burst · Johari Bazaar — jeweller with gem tray · MI Road — patang flyer on rooftop.
**Kolkata** [hibiscus]: Park Street — tram under colonial arch · College Street — bookseller behind book towers · Ballygunge — adda scene with clay chai bhar.
**Chennai** [jasmine]: T. Nagar — silk stack + shopper · Anna Salai — lighthouse + Ambassador-style car silhouette · Besant Nagar — catamaran + filter-coffee pour.
**Bangalore** [rain-tree canopy]: MG Road — metro pillar threaded through rain trees · Indiranagar — café fairy lights + guitarist · Koramangala — laptop on a tea stall + coconut vendor.
**New Delhi** [amaltas]: Connaught Place — colonnade curve · Khan Market — bookshop awning + cyclist · Lodhi Road — dome + parakeet pair.
**Junctions** [none — smoke plumes]: Howrah — cantilever + loco · Mumbai CST — gothic dome + loco · New Delhi Stn — canopy + loco · Chennai Central — red-brick clocktower + loco.
**Utilities** [neem]: Bijli Ghar — bulb + pylon + moth · Jal Board — handpump + brass matka.
**Actions:** kabza — grasping hand over a deed bundle · haathKiSafai — sleight-of-hand with one card · adlaBadli — two hands swapping deeds · nahiChalega — raised open palm · vasooli — ledger and collector's satchel · shagun — decorated gift envelope · aageBadho — signpost arrow + walking figure · makaan — small house frame going up · haveli — grand carved facade · dugna — doubled tally marks on slate.

### 4.4 Plate QC checklist (every plate, before merge)

ratio 100:145 · zero baked text/numerals/logos · palette within (cream, set ink, gold, soft red) · title/ledger/footer zones calm per the contract · figure respectful, no real-person likeness · consistent lithograph density vs. the approved Mumbai reference · exported WebP 600×870, ≤150 KB (quality ~80). Log each pass in `assets/plates/QC.md`.

### 4.5 Fallback plates (build never blocks on art)

`CardFace` first tries `plates/{cardId}.webp`; if absent, it renders the **fallback plate**: the flat two-ink screen-print scene (v1 style, simple SVG per set) inside the same zone contract. Fallbacks ship in code permanently — they also serve as the low-storage "lite" path if we ever need one.

## 5. Screens (as v1, restated deltas only)

Home (logotype, tagline, honest footer line) · Table (rival CHIP clusters, centre piles, your MID sets, FULL hand fan, gold bank stack) · action bottom-sheet with CardFace previews · **payment picker** with live `Paying ₹X of ₹Y · overpaying by ₹Z` + Auto-pay (suggestPayment) · hold-400ms hand-off overlay · ≤60s interactive tutorial · Settings (sound/haptics/reduced-motion/rules/difficulty) · Stats (games, wins, rate, fastest win, KABZAs) · Win/Lose with Victory Deed + one-tap Rematch (<2s to next deal) · icon/splash = सौ matchbox mark.

## 6. Juice stack — `fx/registry.ts` (as v1, plus image discipline)

Registry maps **every** GameEvent → {animation, sound, haptic} (unit test enforces completeness). transform/opacity only. Card press wobble · flight + thwack + light haptic · 60ms deal stagger · 400ms rolling ₹ counters · rent punch · **marigold burst** on set completion (≤18 petals, medium haptic, brass ting) · NAHI sheet + small "NAHI!" stamp · 150ms turn dim · draw-pile breathe idle. Reduced-motion swaps movement for fades, zero information loss.
**Image discipline:** plates get fixed-aspect boxes (no CLS), `decoding="async"`, and a preloader that warms current hands + pile tops before the deal animation starts.

## 7. Signature stamp-slam (KABZA + WIN only) — unchanged from v1

100ms freeze → skewed stamp 1.6→1 (180ms) → impact: ≤4px shake ×3 (120ms) + heavy haptic within 10ms + stamp thud → ink settle → release. Win adds marigold rain then the Victory Deed reveal. Never reused for lesser events.

## 8. The Victory Deed (share engine)

The win poster is now a **deed-style certificate** in the centrepiece language: cream label 1080×1350, ornate border, winner name, big skewed **JEETA!** stamp, the three winning set chips, `won in N turns · date`, factory-footer line `ISSUED BY SAUDA PRESS`, tagline. Rendered from tokens via offscreen node → PNG (`html-to-image` or canvas) → Web Share API with file, download fallback (native share wired in M5). One golden-image test pins it. Tasteful — no upsell text.

## 9. Honest meta — Collection (as v1)

Unlockable backs (Lotus, Kite, Peacock, Rickshaw, Diya — original 3-ink labels) + 3 table colours; unlock table: back2=3 wins · back3=10 games · back4=10 wins · back5=25 KABZAs · table2=5 wins · table3=25 games. Locked = silhouette + condition. Hard rules: no currency/ads/timers/notifications/FOMO; M4d grep for dark-pattern phrases.

## 10. Sound + haptics (as v1)

8 sounds, one howler sprite, <400ms (win 1.2s) · mute-proof rule (every cue has a visual twin) · haptics light/medium/heavy map · web `navigator.vibrate` fallback, silent skip.

## 11. Performance contract (v2 budgets)

60fps floor; deal + stamp-slam may not drop frame bursts · transform/opacity only; `will-change` only on hand fan + stamp layer · particles ≤20 nodes, removed after · input→visual <50ms; haptic ≤10ms from impact frame · memoized CardFace, granular selectors, Profiler check (one event ≠ all cards re-render) · dev FPS/frame-time overlay; before M4c closes, record avg + 1%-low from a scripted 2-min bot game at 4× CPU throttle into `PLAYTEST.md` · **budgets:** JS ≤350 KB gz · fonts ≤120 KB · plates total ≤8 MB WebP (≈40 × ≤150 KB), lazy-loaded, deal-preloaded · Lighthouse ≥90.

## 12. What M4 must NOT do

No engine/rule changes beyond §2.2 hexes and the presentation-only `theme.ts` fields (street tagline, works line, icons/descriptors). No ads/analytics/notification SDKs. No network calls. No new modes. No banned names anywhere. No dark-pattern copy. Plates with any baked text are rejected, not patched.

## 13. Division of labour

- **Engineering:** everything in code — tokens, CardFace two-layer system, fallback plates, screens, fx, share, meta, tests, perf work.
- **Owner (art generation):** produce plates with §4.2 template + §4.3 table, run §4.4 QC, drop files into `assets/plates/`. Plates can arrive in batches; the game is complete-looking at every moment thanks to fallbacks.

## 14. Sub-milestones — strict order, commit + DECISIONS.md + EXPLAIN.md each

- **M4a — Live layer + contract:** tokens, fonts, two-layer `CardFace` (all kinds × 3 sizes), matchstick ladder icons, factory-footer generator, SAUDA PRESS seal, fallback plates for all sets, `/dev/plates` sheet (renders every card, auto-marking plate vs fallback). *Gate:* sheet screenshot approved by me; render tests + full `verify` green.
- **M4-art (parallel, owner):** generate + QC plates in batches; drop in; `/dev/plates` flips them live with zero code changes. *Gate per batch:* QC.md entries.
- **M4b — Screens** · **M4c — Juice + signature** · **M4d — Victory Deed + meta + tutorial + copy review:** as v1, gates unchanged (M4d golden-image now = Victory Deed).

## 15. Final acceptance

`verify` + lint green · plate sheet approved · full game in new UI, zero console errors · fx registry complete · stamp-slam per §7 · perf numbers logged within §11 · Victory Deed shares on web · tutorial <60s · unlocks play-only · zero banned names / dark patterns / baked text in plates · Lighthouse ≥90.
