/**
 * @sauda/difficulty (S6b) — the tier wrapper degrades the frozen recommend() honestly and
 * deterministically, hard stays verbatim, and MUNSHI is exempt (always full strength).
 */
import { describe, it, expect } from 'vitest';
import { legalActions, makeState, mulberry32, observe } from '@sauda/engine';
import { recommend, Munshi } from '@sauda/bots';
import { chooseWithDifficulty, shouldSlip, DifficultyBot, SLIP_PROBABILITY } from './index';

// A mid-game 'playing' state for seat 0 with several legal moves (place / bank / charge / end), so
// there is genuine room to slip off the recommendation.
function midGame() {
  return makeState({
    players: [
      {
        hand: ['prop_mumbai_0', 'money_5_0', 'action_vasooli_0'],
        properties: { mumbai: { cards: ['prop_mumbai_1'] } },
      },
      { bank: ['money_5_1', 'money_1_0'] },
    ],
    currentPlayerIndex: 0,
    phase: 'playing',
    playsRemaining: 3,
  });
}

describe('difficulty wrapper', () => {
  it('the scenario really has room to slip (more than one legal action)', () => {
    const state = midGame();
    expect(legalActions(state, 0).length).toBeGreaterThan(1);
  });

  it('slips at the configured tier probability — measured directly off the gate', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const rng = mulberry32(999);
      let slips = 0;
      const N = 20_000;
      for (let i = 0; i < N; i++) {
        if (shouldSlip(rng, tier)) {
          slips += 1;
        }
      }
      expect(Math.abs(slips / N - SLIP_PROBABILITY[tier])).toBeLessThan(0.02);
    }
  });

  it('is ordered easy > medium > hard, with hard pinned at zero', () => {
    expect(SLIP_PROBABILITY.easy).toBeGreaterThan(SLIP_PROBABILITY.medium);
    expect(SLIP_PROBABILITY.medium).toBeGreaterThan(SLIP_PROBABILITY.hard);
    expect(SLIP_PROBABILITY.hard).toBe(0);
  });

  it('hard plays the full-strength recommendation verbatim, every time (consumes no rng)', () => {
    const state = midGame();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    const strong = recommend(obs, legal, 'hard').action;
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      expect(chooseWithDifficulty(obs, legal, rng, 'hard')).toBe(strong);
    }
  });

  it('is deterministic under the seed — same seed reproduces the same move sequence', () => {
    const state = midGame();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const a = mulberry32(42);
      const b = mulberry32(42);
      const seqA = Array.from({ length: 60 }, () => chooseWithDifficulty(obs, legal, a, tier));
      const seqB = Array.from({ length: 60 }, () => chooseWithDifficulty(obs, legal, b, tier));
      expect(seqA).toEqual(seqB);
    }
  });

  it('easy actually deviates sometimes and agrees sometimes (a weak player, not a broken one)', () => {
    const state = midGame();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    const strong = recommend(obs, legal, 'easy').action;
    const rng = mulberry32(2024);
    let differed = 0;
    let agreed = 0;
    for (let i = 0; i < 2000; i++) {
      if (chooseWithDifficulty(obs, legal, rng, 'easy') === strong) {
        agreed += 1;
      } else {
        differed += 1;
      }
    }
    expect(differed).toBeGreaterThan(0);
    expect(agreed).toBeGreaterThan(0);
  });

  it('every move it returns is one the engine actually offered (always legal)', () => {
    const state = midGame();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    const rng = mulberry32(55);
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < 300; i++) {
        expect(legal).toContain(chooseWithDifficulty(obs, legal, rng, tier));
      }
    }
  });

  it('DifficultyBot is a drop-in Bot with a tier-labelled name', () => {
    const bot = new DifficultyBot('easy');
    expect(bot.name).toBe('DifficultyBot(easy)');
    const state = midGame();
    const legal = legalActions(state, 0); // one array — toContain checks reference identity
    const move = bot.chooseAction(observe(state, 0), legal, mulberry32(1));
    expect(legal).toContain(move);
  });

  it('MUNSHI IS EXEMPT — the advisor is full-strength, never routed through the wrapper', () => {
    const state = midGame();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    // Even at an easy table the Munshi is built at full strength (store: MUNSHI_DIFFICULTY = 'hard').
    const munshi = new Munshi('hard');
    const advice = munshi.advise(obs, legal);
    expect(advice).not.toBeNull();
    expect(advice!.action).toEqual(recommend(obs, legal, 'hard').action);
  });
});
