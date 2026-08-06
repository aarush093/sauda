/**
 * Design tokens (M4 §2). The single source of the SAUDA visual identity used by
 * CardFace and the screens. Colours, type, card sizing, and motion — no values
 * are hard-coded in components.
 */

// §2.1 core colours.
export const INK = {
  tableIndigo: '#1B1E42',
  deepInk: '#14121F',
  cardCream: '#F2E9D2',
  agedLine: '#C0A24E',
  gold: '#E8B84B', // money, seals, win — used sparingly
  stampRed: '#C6342B', // stamps, FULL SET row, danger
  lavender: '#B8B4CE',
  creamBlue: '#C9D4F0',
  // card-art inks — cards are the "bright object class" and carry their own palette.
  mutedBrown: '#5b5344', // serif sublabel / caption on cream
  footerBand: '#E7D3A1', // vintage cream/gold footer band
  actionBanner: '#8C1D1D', // deep-crimson action-card banner
  ledgerSlip: 'rgba(238,229,205,0.93)', // aged-cream ledger-slip fill (~93% opaque)
} as const;

// §M4b visual-constancy tokens (STATE_MATRIX §1 · v1.2 A5). One lighting condition:
// felt background · cream cards · a single gold accent · one glow · one sleep filter ·
// two scrims. No screen may invent a fifth visual state or a second accent.
export const STAGE = {
  felt: INK.tableIndigo, // the only background, everywhere in play
  cardCream: INK.cardCream, // the only bright object class
  accentGold: INK.gold, // the only accent, everywhere
  textOnFelt: 'rgba(242,233,210,0.88)', // cream at ~88% for labels/totals on felt (§2)
  // one glow spec — active-player ring · legal-action glow · selection · Munshi (no variants)
  glowGold: `0 0 0 2px ${INK.gold}, 0 0 10px 1px rgba(232,184,75,0.5)`,
  dimSleep: 'saturate(0.7) brightness(0.9)', // off-turn hand/board only
  scrimDrag: 'rgba(20,18,31,0.08)', // ~8% behind a lifted/staged card (Phase 2)
  scrimSheet: 'rgba(20,18,31,0.35)', // ~35% behind bottom sheets / handoff (Phase 3)
} as const;

// Dev-only HUD chrome (P2 — never shipped: rendered only under `?hud=1` in a dev build). Kept in
// tokens so the colour-constancy guard stays green; it is not part of the game's visual language.
export const DEV_HUD = {
  panelFill: 'rgba(20,18,31,0.82)', // dark ink scrim so the readout is legible over any zone
  panelText: INK.creamBlue,
  panelBorder: 'rgba(232,184,75,0.5)', // the gold accent at half strength
  alertFill: INK.stampRed, // PHONE-2 Q3: the reduced-motion "ON" banner — an unmissable filled red
  alertText: '#FFFFFF', // pure white on that red banner for maximum contrast (dev instrument only)
} as const;

// Soft elevation only (2–8 dp) — the vintage-paper world has weight, not neon.
export const SHADOW = {
  titleKeyline: '0 0 1.5px rgba(20,18,31,0.85), 0 1px 1px rgba(20,18,31,0.55)', // cream title halo
  ledgerSlip: '0 1px 2px rgba(20,18,31,0.20), inset 0 0 5px rgba(150,120,60,0.14)', // pasted-slip lift
  cardBack: '0 1px 2px rgba(0,0,0,0.35)', // face-down card lift
  dragLift: '0 12px 20px rgba(20,18,31,0.45)', // a card lifted out of the hand mid-drag (A10 L3)
} as const;

// Drop-zone glow (A10 · STATE_MATRIX §1). The one GLOW_GOLD marks the zone UNDER the
// pointer (hot); an eligible-but-not-hot zone wears just a gold keyline (soft) — same
// accent, no second colour, so "one glow" still holds.
export const GLOW = {
  soft: `0 0 0 2px ${INK.gold}`, // eligible drop zone
  hot: STAGE.glowGold, // the zone under the dragged card
} as const;

// §2.4 typography. Families resolve to the self-hosted faces in fonts.css.
export const FONT = {
  display: "'Baloo 2', system-ui, sans-serif", // chunky, Devanagari-capable — headings/logo
  body: "'Karla', system-ui, sans-serif", // UI chrome only — never on the card face
  mono: "'IBM Plex Mono', ui-monospace, monospace", // tabular numerals / money
  // Vintage letterpress voice for card labels/captions. A system serif stack, so it
  // stays fully offline (no fetch); the card face uses this instead of a modern sans.
  serif: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
} as const;

// §2.4 card sizing. Ratio is height / width = 145 / 100. There is ONE card width now (G4 LAW):
// every card is the full face drawn at `fullWidth`, then transform-scaled by ScaledCard where a
// smaller size is needed — so the design is pixel-identical at every place a card appears.
export const CARD = {
  ratio: 145 / 100,
  fullWidth: 132,
} as const;

// The ONE stacking scale (P2 — owner phone test 1 Aug). The owner's phone showed dark slabs and
// ticker text drawn OVER cards — classic ad-hoc-z-index bugs (a slab at z8 above a card at z4).
// Every zIndex in the app is now drawn from HERE, low → high, so "what draws over what" is one
// ordered list instead of a scatter of magic numbers. A lint gate (eslint no-restricted-syntax)
// bans raw numeric `zIndex:` literals so nothing can drift off this scale again.
//
// Order (bottom → top): the felt, then the board's own bands, then the drag ghost, then the modal
// surfaces the game waits on, then transient toasts, the end panel, and the debug HUD on top.
// INSPECT sits BELOW the drag ghost on purpose: you can drag a card straight out of the inspect
// overlay to commit, so the floating ghost must ride above it.
export const LAYERS = {
  felt: 0, // the table background
  board: 1, // the board's static content (groups, bank, pile, headers)
  myArea: 2, // my area band (over the felt, sleeps off-turn)
  wheel: 3, // the hand wheel — over my area so a peeked card lifts clear
  ticker: 4, // the 2-line ticker on centre stage
  stage: 5, // the centre-stage spotlight card — brightest thing during a play (must beat ticker)
  nav: 8, // P8: the in-game home glyph — over the board, under the drag ghost + all overlays
  inspect: 10, // the tap-to-inspect card (drag-through: the ghost rides above it)
  dragGhost: 20, // the floating dragged card — above the board + inspect, below modal surfaces
  surface: 30, // modal surfaces the game waits on: discard, targeting, rearrange, table view, beat
  sheet: 40, // response windows: the payment sheet, the NAHI CHALEGA prompt
  toast: 50, // P3: a transient one-line hint ("drop on a glowing set")
  end: 60, // the game-over panel — above every in-play surface
  badge: 70, // a label/badge pinned over its own card art (local, but on the shared scale)
  // PHONE-2 Q2: the Munshi advice card is a full-screen consult that must sit above EVERYTHING it
  // explains — including the board's own pinned badges (FULL SET / rent / money pips at `badge`).
  // At its old 45 those badges punched through the card (the owner's "pips overlapping the advice"
  // break). It sits just under the dev HUD so nothing in-play can overlap it.
  advice: 80, // the Munshi advice card — above the board, its sheets AND its pinned badges
  // R0 (owner landscape directive, 2 Aug): the rotate-to-play interstitial. SAUDA is landscape-only;
  // in portrait this full-screen shell hides the (unmounted, paused) game, so it must sit above every
  // in-play surface. It stays UNDER the dev HUD so a dev can still read the orientation line on top.
  rotate: 85, // the portrait "rotate your phone" gate
  hud: 90, // the dev HUD debug instrument — top of everything
} as const;

// §2.4 motion tokens (consumed by the fx layer in M4c).
export const MOTION = {
  spring: { stiffness: 380, damping: 26 },
  press: { stiffness: 500, damping: 30 },
  counterMs: 400,
  dealStaggerMs: 60,
  freezeMs: 100,
  shakeMaxPx: 4,
} as const;
