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

// §2.4 card sizing. Ratio is height / width = 145 / 100.
export const CARD = {
  ratio: 145 / 100,
  // Fixed pixel widths keep the dev sheet and tests deterministic; the responsive
  // table sizing (clamp) is applied where cards are laid out (M4b).
  fullWidth: 132,
  midWidth: 76,
  chipWidth: 46,
} as const;

export type CardSize = 'full' | 'mid' | 'chip';

export function cardWidth(size: CardSize): number {
  if (size === 'full') return CARD.fullWidth;
  if (size === 'mid') return CARD.midWidth;
  return CARD.chipWidth;
}

// §2.4 motion tokens (consumed by the fx layer in M4c).
export const MOTION = {
  spring: { stiffness: 380, damping: 26 },
  press: { stiffness: 500, damping: 30 },
  counterMs: 400,
  dealStaggerMs: 60,
  freezeMs: 100,
  shakeMaxPx: 4,
} as const;
