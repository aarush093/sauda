/**
 * The invariant harness (§8.2) — the project's safety net.
 *
 * The headline invariant is card conservation: exactly the 106 master card ids
 * must be present across all zones at all times, each exactly once. Because cards
 * mid-resolution live in the interrupt frame (`cardsInFlight` / `pendingReceive`),
 * we count those too — that is why an action card is never "lost" while a charge
 * is being answered.
 */
import type { SetId } from './types';
import { SETS } from './theme';
import type { CardId, GameState } from './state';

const ALL_SETS = Object.keys(SETS) as SetId[];

// Every card id currently anywhere in the game, including cards in flight inside
// the interrupt stack.
export function accountedCardIds(state: GameState): CardId[] {
  const ids: CardId[] = [];
  ids.push(...state.drawPile, ...state.discardPile);
  for (const player of state.players) {
    ids.push(...player.hand, ...player.bank);
    for (const set of ALL_SETS) {
      const group = player.properties[set];
      ids.push(...group.cards, ...group.buildings);
    }
  }
  for (const interrupt of state.pendingInterrupts) {
    ids.push(...interrupt.nahiChain);
    for (const item of interrupt.pendingReceive) {
      ids.push(item.cardId);
    }
  }
  return ids;
}

export interface InvariantResult {
  ok: boolean;
  violations: string[];
}

// Structural checks that must hold after EVERY reduce (turn-boundary-specific
// checks live in the property tests where the boundary is known).
export function checkInvariants(state: GameState): InvariantResult {
  const violations: string[] = [];

  // 1. Card conservation: exactly the 106 masters, each once.
  const accounted = accountedCardIds(state);
  const expected = Object.keys(state.cards);
  if (accounted.length !== expected.length) {
    violations.push(`card count ${accounted.length} != ${expected.length}`);
  }
  const seen = new Set<CardId>();
  for (const id of accounted) {
    if (seen.has(id)) {
      violations.push(`duplicate card id: ${id}`);
    }
    seen.add(id);
    if (!(id in state.cards)) {
      violations.push(`unknown card id in play: ${id}`);
    }
  }
  for (const id of expected) {
    if (!seen.has(id)) {
      violations.push(`missing card id: ${id}`);
    }
  }

  // 2. Plays used never exceeds the per-turn budget.
  if (state.playsRemaining < 0 || state.playsRemaining > state.rules.playsPerTurn) {
    violations.push(`playsRemaining out of range: ${state.playsRemaining}`);
  }

  // 3. The interrupt stack is empty except while actively playing a turn.
  if (state.phase !== 'playing' && state.pendingInterrupts.length > 0) {
    violations.push(`interrupts pending in phase ${state.phase}`);
  }

  return { ok: violations.length === 0, violations };
}
