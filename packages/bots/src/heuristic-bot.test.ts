/**
 * HeuristicBot behaviour, including the key directive: payment decisions are
 * delegated to the engine's suggestPayment (surfaced as the RESPOND_PAY that
 * legalActions provides) — the bot must never build its own selection.
 */
import { describe, it, expect } from 'vitest';
import {
  legalActions,
  makeState,
  mulberry32,
  observe,
  reduce,
  suggestPayment,
} from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { HeuristicBot } from './heuristic-bot';

const rng = mulberry32(1);
const bot = new HeuristicBot('medium');

function choose(state: ReturnType<typeof makeState>, actor: number): Action {
  return bot.chooseAction(observe(state, actor), legalActions(state, actor), rng);
}

describe('HeuristicBot', () => {
  it('declares a win the instant it holds three sets', () => {
    const state = makeState({
      players: [
        {
          properties: {
            mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] },
            puraniDilli: { cards: ['prop_puraniDilli_0', 'prop_puraniDilli_1'] },
            utility: { cards: ['prop_utility_0', 'prop_utility_1'] },
          },
        },
        {},
      ],
      currentPlayerIndex: 0,
      phase: 'awaitingDraw',
    });
    expect(choose(state, 0)).toEqual({ type: 'DECLARE_WIN' });
  });

  it('delegates payment to the engine suggestPayment (identical selection)', () => {
    // Set up a charge the bot must answer with a payment.
    let state = makeState({
      players: [{ hand: ['action_vasooli_0'] }, { bank: ['money_5_0', 'money_1_0', 'money_1_1'] }],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = reduceOk(state, { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } });
    state = reduceOk(state, { type: 'RESPOND_ALLOW' }); // target complies → payment window

    const chosen = bot.chooseAction(observe(state, 1), legalActions(state, 1), rng);
    expect(chosen.type).toBe('RESPOND_PAY');

    const expected = suggestPayment(state, { debtor: 1, creditor: 0, amountOwed: 5 });
    if (chosen.type === 'RESPOND_PAY') {
      // The bot's payment is exactly what the shared helper produced — no re-implementation.
      expect(chosen.cardIds).toEqual(expected);
    }
  });

  it('places a property toward a set rather than idling', () => {
    const state = makeState({
      players: [{ hand: ['prop_mumbai_0'] }, {}],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const action = choose(state, 0);
    // With a bankable-less hand it should place the property, not end the turn.
    expect(action.type).toBe('PLACE_PROPERTY');
  });
});

function reduceOk(state: ReturnType<typeof makeState>, action: Action) {
  const result = reduce(state, action);
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value.state;
}
