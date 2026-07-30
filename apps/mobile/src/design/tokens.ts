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

// §2.4 motion tokens (consumed by the fx layer in M4c).
export const MOTION = {
  spring: { stiffness: 380, damping: 26 },
  press: { stiffness: 500, damping: 30 },
  counterMs: 400,
  dealStaggerMs: 60,
  freezeMs: 100,
  shakeMaxPx: 4,
} as const;
