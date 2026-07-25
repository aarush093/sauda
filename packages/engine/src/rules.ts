/**
 * Engine-level rule configuration (§7).
 *
 * Kept separate from theme.ts on purpose: theme.ts is player-facing *text*,
 * this is *numeric/behavioural* config. Every genuine rule variant lives here
 * behind a default, so a house-rule change is a one-object edit and never a
 * scatter of magic numbers through the engine.
 */
export const DEFAULT_RULES = {
  players: { min: 2, max: 4 },
  handLimit: 7, // §4.4 step 4: discard down to this at end of turn
  playsPerTurn: 3, // §4.4 step 3
  drawPerTurn: 2, // §4.4 step 2
  emptyHandDraw: 5, // §4.4 step 2: draw 5 instead if hand is empty at turn start
  maxDugnaPerCharge: 2, // §5 DUGNA: 1 = classic-strict; 2 lets rent reach 4×
  buildingsStackRent: true, // §5: MAKAAN +₹3 and HAVELI +₹4 both count
  orphanedBuildings: 'toBank', // §4.5: when a set breaks — 'toBank' | 'stay'
  winDeclaredOnOwnTurnOnly: true, // §4.1: win fires only on the winner's own turn
} as const;

export type Rules = typeof DEFAULT_RULES;
