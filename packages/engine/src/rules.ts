/**
 * Engine-level rule configuration (§7).
 *
 * Kept separate from theme.ts on purpose: theme.ts is player-facing *text*,
 * this is *numeric/behavioural* config. Every genuine rule variant lives here
 * behind a default, so a house-rule change is a one-object edit and never a
 * scatter of magic numbers through the engine.
 *
 * `Rules` is an explicit interface (not `typeof DEFAULT_RULES`) so variant fields
 * like `orphanedBuildings` keep their full union type instead of narrowing to the
 * single default value.
 */
export interface Rules {
  players: { min: number; max: number };
  handLimit: number; // §4.4 step 4: discard down to this at end of turn
  playsPerTurn: number; // §4.4 step 3
  drawPerTurn: number; // §4.4 step 2
  emptyHandDraw: number; // §4.4 step 2: draw this many if hand is empty at turn start
  maxDugnaPerCharge: number; // §5 DUGNA: 1 = classic-strict; 2 lets rent reach 4×
  buildingsStackRent: boolean; // §5: MAKAAN +₹3 and HAVELI +₹4 both count
  orphanedBuildings: 'toBank' | 'stay'; // §4.5: when a set breaks
  winDeclaredOnOwnTurnOnly: boolean; // §4.1: win fires only on the winner's own turn
}

export const DEFAULT_RULES: Rules = {
  players: { min: 2, max: 4 },
  handLimit: 7,
  playsPerTurn: 3,
  drawPerTurn: 2,
  emptyHandDraw: 5,
  maxDugnaPerCharge: 2,
  buildingsStackRent: true,
  orphanedBuildings: 'toBank',
  winDeclaredOnOwnTurnOnly: true,
};
