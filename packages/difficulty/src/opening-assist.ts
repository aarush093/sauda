/**
 * @sauda/difficulty — the EASY opening-hand assist (U4). Even with the easy bot rebuilt as a gentle,
 * plausible beginner (see index.ts TRAITS), a true first-timer starts too far behind to hit the owner's
 * easy target (~4 wins in 5). The reason is structural, not a tuning miss: a beginner who plays close to
 * random loses the set-race to ANY bot that reliably banks and builds — and the owner's rule is that the
 * bot must stay a plausible beginner, never be broken to throw the game. So instead of crippling the
 * bot, we give the HUMAN a leg-up at the deal, and ONLY on easy.
 *
 * The assist swaps a few of the human's least-useful opening cards (its smallest money) for the best
 * building material (a property, else a wildcard) waiting in the shuffled draw pile. It is a fair SWAP,
 * not an injection: the deck stays complete (all 106 cards accounted for), nothing is added, and nothing
 * is rigged after the deal — the mid-game shuffle and draws are untouched. It is deterministic (it reads
 * the already-shuffled pile top-down, no Math.random), so a seed still reproduces the game exactly.
 *
 * It is gated behind ONE clearly-named constant so the owner can tune it by feel, or switch it off, in
 * one place. See DECISIONS "U4" for why it was required and the win-rate lift it produces.
 */
import type { Card, CardId, GameState } from '@sauda/engine';

// How many of the human's opening cards the easy assist may upgrade. Tuned against the >=1000-game
// beginner-proxy harness (`pnpm --filter @sauda/tools winrates`) to land the easy band. Set to 0 to
// switch the assist off entirely.
export const EASY_OPENING_ASSIST_CARDS = 5;

// A card worth building a set with — the material the assist pulls into the human's hand.
function isBuildingMaterial(card: Card): boolean {
  return card.kind === 'property' || card.kind === 'wildcard';
}

/**
 * Return a state where `seat`'s opening hand has been nudged stronger for the EASY assist: up to
 * EASY_OPENING_ASSIST_CARDS of its smallest money cards are swapped for the best building material at
 * the top of the draw pile. Pure — never mutates the input; returns the same state unchanged if there
 * is nothing to swap or the assist is switched off.
 */
export function assistOpeningHand(state: GameState, seat: number): GameState {
  if (EASY_OPENING_ASSIST_CARDS <= 0) {
    return state;
  }
  const player = state.players[seat];
  if (!player) {
    return state;
  }
  const cardOf = (id: CardId): Card => state.cards[id]!;

  const hand = [...player.hand];
  const drawPile = [...state.drawPile];

  // The cards to give away: everything in hand that is NOT building material (money and action/rent
  // cards), least valuable first. We never trade away a property or wildcard, so the human only ever
  // GAINS set-building material; and because most hands hold several non-building cards, the assist
  // reliably fires (money alone was often absent from a 5-card opening hand).
  const giveOut = hand
    .filter((id) => !isBuildingMaterial(cardOf(id)))
    .sort((a, b) => cardOf(a).value - cardOf(b).value);

  let swaps = 0;
  for (let i = 0; i < drawPile.length && swaps < EASY_OPENING_ASSIST_CARDS && swaps < giveOut.length; i++) {
    const incoming = drawPile[i]!;
    if (!isBuildingMaterial(cardOf(incoming))) {
      continue;
    }
    const outgoing = giveOut[swaps]!;
    // Fair swap: the property/wildcard comes into the hand; the money card takes its vacated draw-pile
    // slot, so the pile length and the 106-card total are preserved exactly.
    drawPile[i] = outgoing;
    hand[hand.indexOf(outgoing)] = incoming;
    swaps += 1;
  }

  if (swaps === 0) {
    return state;
  }
  const players = state.players.map((p, index) => (index === seat ? { ...p, hand } : p));
  return { ...state, players, drawPile };
}
