/**
 * Munshi: the 3-use budget, read-only + deterministic behaviour, shared brain with
 * HeuristicBot, and one test per reasoning template. Scenarios are built through the
 * real engine (makeState -> observe + legalActions) so the (Observation, legalActions)
 * pairs are exactly what the app would hand Munshi.
 */
import { describe, it, expect } from 'vitest';
import { legalActions, makeState, mulberry32, observe, reduce } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { HeuristicBot } from './heuristic-bot';
import { Munshi } from './munshi';

type S = ReturnType<typeof makeState>;

function decisionAt(state: S, actor: number) {
  return { observation: observe(state, actor), legal: legalActions(state, actor) };
}
function reduceOk(state: S, action: Action): S {
  const result = reduce(state, action);
  if (!result.ok) {
    throw new Error(result.error.code);
  }
  return result.value.state;
}

describe('Munshi — 3-use budget (project law)', () => {
  it('gives exactly 3 pieces of advice per game, then nothing', () => {
    const state = makeState({ players: [{ hand: ['prop_mumbai_0'] }, {}], currentPlayerIndex: 0, playsRemaining: 3 });
    const { observation, legal } = decisionAt(state, 0);
    const munshi = new Munshi('medium');

    expect(munshi.usesRemaining).toBe(3);
    expect(munshi.advise(observation, legal)).not.toBeNull();
    expect(munshi.usesRemaining).toBe(2);
    expect(munshi.advise(observation, legal)).not.toBeNull();
    expect(munshi.advise(observation, legal)).not.toBeNull();
    expect(munshi.usesRemaining).toBe(0);

    expect(munshi.advise(observation, legal)).toBeNull(); // budget spent
    expect(munshi.usesRemaining).toBe(0); // and no negative drift
  });

  it('spends no use when there is nothing to decide', () => {
    const munshi = new Munshi('medium');
    expect(munshi.advise(observe(makeState({ players: [{}, {}] }), 1), [])).toBeNull();
    expect(munshi.usesRemaining).toBe(3);
  });
});

describe('Munshi — read-only, deterministic, shares the bot brain', () => {
  it('never mutates the observation or the legal actions', () => {
    const state = makeState({ players: [{ hand: ['prop_mumbai_0'] }, {}], currentPlayerIndex: 0, playsRemaining: 3 });
    const { observation, legal } = decisionAt(state, 0);
    const snapshot = JSON.stringify({ observation, legal });
    new Munshi('medium').advise(observation, legal);
    expect(JSON.stringify({ observation, legal })).toBe(snapshot); // inputs untouched
  });

  it('is deterministic: same state -> same advice', () => {
    const state = makeState({ players: [{ hand: ['prop_mumbai_0', 'prop_mumbai_1'] }, {}], currentPlayerIndex: 0, playsRemaining: 3 });
    const { observation, legal } = decisionAt(state, 0);
    expect(new Munshi('medium').advise(observation, legal)).toEqual(new Munshi('medium').advise(observation, legal));
  });

  it('recommends exactly what the HeuristicBot would play (shared brain)', () => {
    const state = makeState({ players: [{ hand: ['prop_mumbai_0'] }, {}], currentPlayerIndex: 0, playsRemaining: 3 });
    const { observation, legal } = decisionAt(state, 0);
    const advice = new Munshi('medium').advise(observation, legal)!;
    const botMove = new HeuristicBot('medium').chooseAction(observation, legal, mulberry32(1));
    expect(advice.action).toEqual(botMove);
  });
});

describe('Munshi — one line per reasoning template', () => {
  it('completesSet: a placement that completes a set', () => {
    const state = makeState({
      players: [{ hand: ['prop_mumbai_1'], properties: { mumbai: { cards: ['prop_mumbai_0'] } } }, {}],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const { observation, legal } = decisionAt(state, 0);
    const advice = new Munshi('medium').advise(observation, legal)!;
    expect(advice.reason).toBe('completesSet');
    expect(advice.action.type).toBe('PLACE_PROPERTY');
    expect(advice.line).toContain('completes');
  });

  it('deniesSet: KABZA an opponent’s complete set', () => {
    const state = makeState({
      players: [
        { hand: ['action_kabza_0'] },
        { properties: { mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'] } } },
      ],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const { observation, legal } = decisionAt(state, 0);
    const advice = new Munshi('medium').advise(observation, legal)!;
    expect(advice.reason).toBe('deniesSet');
    expect(advice.line).toContain('Kabza');
  });

  it('protectsSet: play NAHI when the threat is worth cancelling', () => {
    let state = makeState({
      players: [{ hand: ['action_vasooli_0'] }, { hand: ['action_nahiChalega_0'], bank: ['money_5_0'] }],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = reduceOk(state, { type: 'PLAY_ACTION', cardId: 'action_vasooli_0', params: { action: 'vasooli', target: 1 } });
    const { observation, legal } = decisionAt(state, 1); // player 1 answers off-turn
    const advice = new Munshi('medium').advise(observation, legal)!;
    expect(advice.reason).toBe('protectsSet');
    expect(advice.action.type).toBe('RESPOND_NAHI_CHALEGA');
    expect(advice.line).toContain('Nahi');
  });

  it('bestValue: a charge that beats banking it', () => {
    const state = makeState({
      players: [{ hand: ['action_vasooli_0'] }, { bank: ['money_5_0'] }],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    const { observation, legal } = decisionAt(state, 0);
    const advice = new Munshi('medium').advise(observation, legal)!;
    expect(advice.reason).toBe('bestValue');
    expect(advice.line.toLowerCase()).toContain('value');
  });

  it('preservesCounter: hold NAHI when the threat is small', () => {
    let state = makeState({
      players: [{ hand: ['action_shagun_0'] }, { hand: ['action_nahiChalega_0'], bank: ['money_2_0'] }],
      currentPlayerIndex: 0,
      playsRemaining: 3,
    });
    state = reduceOk(state, { type: 'PLAY_ACTION', cardId: 'action_shagun_0', params: { action: 'shagun' } });
    const { observation, legal } = decisionAt(state, 1);
    const advice = new Munshi('medium').advise(observation, legal)!;
    expect(advice.reason).toBe('preservesCounter');
    expect(advice.action.type).toBe('RESPOND_ALLOW');
    expect(advice.line).toContain('Nahi');
  });

  it('generic: opening the turn with a draw', () => {
    const state = makeState({ players: [{ hand: ['money_1_0'] }, {}], currentPlayerIndex: 0, phase: 'awaitingDraw' });
    const { observation, legal } = decisionAt(state, 0);
    const advice = new Munshi('medium').advise(observation, legal)!;
    expect(advice.reason).toBe('generic');
    expect(advice.action.type).toBe('DRAW');
    expect(advice.line.length).toBeGreaterThan(0);
  });
});
