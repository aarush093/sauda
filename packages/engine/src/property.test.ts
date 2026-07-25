/**
 * Property-based invariant tests (§8.2). We drive full games with a legal-move bot
 * over many seeds and assert the engine's invariants hold at every step:
 *  - exactly 106 cards are always accounted for
 *  - a card on the table never returns to any hand
 *  - plays used never exceeds the per-turn budget
 *  - the interrupt stack is empty at every turn boundary
 *  - hands are within the limit at the start of each turn
 *  - the game terminates in under 500 turns
 *
 * The bot is "progress-biased" (prefers declaring a win, then placing property)
 * so games actually finish; it still exercises charges, payments and interrupts.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createGame } from './setup';
import { reduce } from './reduce';
import { legalActions } from './legal';
import { checkInvariants } from './invariants';
import { mulberry32 } from './rng';
import type { Action } from './actions';
import type { CardId, GameState } from './state';

// Whose move is it: the interrupt responder if a window is open, else the turn player.
function actorFor(state: GameState): number {
  if (state.pendingInterrupts.length > 0) {
    return state.pendingInterrupts[state.pendingInterrupts.length - 1]!.responder;
  }
  return state.currentPlayerIndex;
}

// Progress-biased choice: win if you can, otherwise place a property if you can,
// otherwise pick any legal action. Keeps games moving toward completion.
function chooseAction(actions: Action[], random: () => number): Action {
  const win = actions.find((a) => a.type === 'DECLARE_WIN');
  if (win) {
    return win;
  }
  const placements = actions.filter((a) => a.type === 'PLACE_PROPERTY');
  const pool = placements.length > 0 ? placements : actions;
  return pool[Math.floor(random() * pool.length)]!;
}

// All card ids currently on any player's table (bank + property area + buildings).
function tableCardIds(state: GameState): CardId[] {
  const ids: CardId[] = [];
  for (const player of state.players) {
    ids.push(...player.bank);
    for (const group of Object.values(player.properties)) {
      ids.push(...group.cards, ...group.buildings);
    }
  }
  return ids;
}

function anyHandContains(state: GameState, ids: Set<CardId>): CardId | null {
  for (const player of state.players) {
    for (const id of player.hand) {
      if (ids.has(id)) {
        return id;
      }
    }
  }
  return null;
}

interface GameOutcome {
  finished: boolean;
  turns: number;
}

function playGame(seed: number, playerCount: number): GameOutcome {
  let { state } = createGame({ players: playerCount, seed });
  const random = mulberry32(seed ^ 0x9e3779b9);
  const everOnTable = new Set<CardId>();
  let steps = 0;

  while (state.phase !== 'gameOver' && state.turnCount < 500 && steps < 30000) {
    // Invariant: once a card is on the table it must never appear in a hand again.
    const offender = anyHandContains(state, everOnTable);
    expect(offender, `card ${offender} returned to a hand`).toBeNull();

    // Invariant: interrupt stack empty and hands within limit at each turn start.
    if (state.phase === 'awaitingDraw') {
      expect(state.pendingInterrupts).toHaveLength(0);
      for (const player of state.players) {
        expect(player.hand.length).toBeLessThanOrEqual(state.rules.handLimit);
      }
    }

    const actor = actorFor(state);
    const actions = legalActions(state, actor);
    expect(actions.length, 'a player in play must always have a legal action').toBeGreaterThan(0);

    const result = reduce(state, chooseAction(actions, random));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      break;
    }
    state = result.value.state;

    // Core invariant after every single reduce.
    const invariants = checkInvariants(state);
    expect(invariants.ok, invariants.violations.join('; ')).toBe(true);
    expect(state.playsRemaining).toBeLessThanOrEqual(state.rules.playsPerTurn);

    for (const id of tableCardIds(state)) {
      everOnTable.add(id);
    }
    steps += 1;
  }

  return { finished: state.phase === 'gameOver', turns: state.turnCount };
}

describe('invariants over many random games (§8.2)', () => {
  it('holds every invariant and terminates under 500 turns', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 2, max: 4 }), (seed, players) => {
        const outcome = playGame(seed, players);
        expect(outcome.finished).toBe(true);
        expect(outcome.turns).toBeLessThan(500);
      }),
      { numRuns: 40 },
    );
  });
});
