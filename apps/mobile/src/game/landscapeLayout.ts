/**
 * Landscape zone maths — LAYOUT v3, FOCUS FOLLOWS TURN (owner landscape directive, 2 Aug). This is
 * the spec amendment made provable: pure functions that split the landscape canvas (~740-915 wide ×
 * 360-412 tall) into the two screen states, so the layout is unit-tested without a browser and the
 * HUD / captures read exactly what these compute.
 *
 * THREE screen states (only the two that need geometry live here; overlays lay themselves out):
 *   A. MY TURN — my world only. A far-edge bot RAIL, then three top-row columns (my sets | play
 *      stage | bank+Munshi+turn token), and a WIDE wheel band across the bottom (hub bottom-centre,
 *      the full width minus the rail — the "bigger, clearer roulette" the owner asked for). The wheel
 *      is its own bottom ROW, so the bank tray and turn token (top row) can never collide with it.
 *   B. SPECTATE — any bot's turn. The rail, then a split: the acting bot's panel (the larger share,
 *      where their played card is spotlit) and MY panel (my sets + bank + hand as backs). I always
 *      see what is being done TO me.
 *
 * Every number is px. The owner tunes the landscape rhythm HERE, in one place.
 */

export const LANDSCAPE = {
  railWidth: 46, // the far-edge vertical bot tab rail (B1/B2/B3 chips)
  gap: 8, // the gutter between columns / panels
  sideColMin: 128, // my-sets column and the controls column each want at least this
  sideColMax: 200, // past this the side columns waste width the stage could use
  sideColFraction: 0.2, // each side column targets this fraction of the content width
  wheelBandFraction: 0.46, // the wheel band takes this share of the height (the rest is the top row)
  wheelBandMin: 150, // …but never thinner than a legible wheel (an 78px card + its arc ≈ 159)
  wheelBandMax: 178, // …nor taller than it needs (extra height would just push the top row thin)
  spectateActingFraction: 0.58, // the acting bot's panel share in spectate (58% — "the larger share")
  spectateActingMin: 300, // the acting panel never collapses below a readable board width
} as const;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export interface MyTurnZones {
  rail: number; // the bot rail width (far left)
  leftCol: number; // my-sets column width (top row)
  centre: number; // play-stage column width (top row) — the widest
  rightCol: number; // bank + Munshi + turn-token column width (top row)
  topRow: number; // the height of the top row (sets · stage · controls)
  wheelBand: number; // the height of the bottom wheel band
  wheelContainer: number; // the width the wheel spans (everything but the rail) — hub sits at its centre
}

/**
 * MY TURN geometry. The wheel spans the full width minus the rail (its own bottom row), so a wide,
 * clear arc; the three top-row columns share that same width. Side columns clamp to a sensible band
 * and the centre stage takes whatever is left (always the widest), so the stage breathes on a wide
 * phone and the side columns stay legible on a narrow one.
 */
export function resolveMyTurn(width: number, height: number, limits = LANDSCAPE): MyTurnZones {
  const rail = limits.railWidth;
  const content = width - rail; // the width available to the columns and the wheel
  const side = clamp(Math.round(content * limits.sideColFraction), limits.sideColMin, limits.sideColMax);
  // Two side columns + three gutters (rail|left, left|centre, centre|right) carved out of the content.
  const centre = Math.max(0, content - side * 2 - limits.gap * 3);

  const wheelBand = clamp(Math.round(height * limits.wheelBandFraction), limits.wheelBandMin, limits.wheelBandMax);
  const topRow = height - wheelBand;

  return {
    rail,
    leftCol: side,
    centre,
    rightCol: side,
    topRow,
    wheelBand,
    wheelContainer: content, // the wheel breathes across the whole content width, hub at its centre
  };
}

export interface SpectateZones {
  rail: number; // the non-acting bot rail (far left)
  acting: number; // the acting bot's panel width (the larger share — their card is spotlit here)
  mine: number; // my panel width (my sets + bank + hand backs)
}

/**
 * SPECTATE geometry. The rail, then a split between the acting bot's panel (the larger share) and my
 * panel. The acting panel clamps to a floor so a bot's board stays readable even on the narrowest
 * phone; my panel takes the rest (and is never wider than the acting panel — the focus is the bot
 * acting on me, but I always keep a real view of my own board).
 */
export function resolveSpectate(width: number, _height: number, limits = LANDSCAPE): SpectateZones {
  const rail = limits.railWidth;
  const content = width - rail - limits.gap; // rail + one gutter before the split
  const acting = Math.max(limits.spectateActingMin, Math.round(content * limits.spectateActingFraction));
  const mine = Math.max(0, content - acting);
  return { rail, acting, mine };
}
