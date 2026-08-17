/**
 * @sauda/difficulty (U4) — the tier wrapper builds CHARACTER, not randomness. A weak tier suppresses
 * classes of move (attacks, free rearranges, a premature declare, NAHI) and falls back to its best
 * REMAINING legal move (never a random one), plus a small quiet random-slip residual. Hard stays
 * byte-identical to the frozen recommend() and draws no rng; MUNSHI is exempt (always full strength).
 */
import { describe, it, expect } from 'vitest';
import { legalActions, makeState, mulberry32, observe } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import { recommend, Munshi } from '@sauda/bots';
import { chooseWithDifficulty, skilledEnough, DifficultyBot, TRAITS } from './index';

// A mid-game 'playing' state for seat 0 with several legal moves (place / bank / charge / end), so there
// is genuine room for the traits to change the move.
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

// A state where the STRONG play is a take-that attack (VASOOLI): seat 0 has no property to build with,
// just an attack card + a money card, and seat 1 has bankable value worth charging.
function attackIsBest() {
  return makeState({
    players: [{ hand: ['action_vasooli_0', 'money_1_0'] }, { bank: ['money_5_1'] }],
    currentPlayerIndex: 0,
    phase: 'playing',
    playsRemaining: 3,
  });
}

// A state where the STRONG play is a BUILD (placing a property that advances a set).
function buildIsBest() {
  return makeState({
    players: [{ hand: ['prop_mumbai_0', 'money_1_0'], properties: { mumbai: { cards: ['prop_mumbai_1'] } } }, {}],
    currentPlayerIndex: 0,
    phase: 'playing',
    playsRemaining: 3,
  });
}

function isAttackMove(action: Action): boolean {
  if (action.type === 'PLAY_KIRAYA') return true;
  if (action.type === 'PLAY_ACTION') {
    return ['kabza', 'haathKiSafai', 'vasooli', 'shagun', 'adlaBadli'].includes(action.params.action);
  }
  return false;
}

describe('difficulty traits (U4)', () => {
  it('the scenario really has room for the traits to bite (more than one legal action)', () => {
    expect(legalActions(midGame(), 0).length).toBeGreaterThan(1);
  });

  it('every trait is ordered easy < medium < hard, with hard pinned at full strength', () => {
    for (const facet of ['aggression', 'greed', 'wildcardSkill', 'defence', 'closing'] as const) {
      expect(TRAITS.easy[facet]).toBeLessThan(TRAITS.medium[facet]);
      expect(TRAITS.medium[facet]).toBeLessThan(TRAITS.hard[facet]);
      expect(TRAITS.hard[facet]).toBe(1);
    }
    // The random slip is the reverse — a small residual that shrinks toward zero as the tier improves.
    expect(TRAITS.easy.randomSlip).toBeGreaterThan(TRAITS.medium.randomSlip);
    expect(TRAITS.hard.randomSlip).toBe(0);
  });

  it('the skill gate fires at each trait probability — measured directly (per-trait bands)', () => {
    for (const tier of ['easy', 'medium'] as const) {
      for (const facet of ['aggression', 'greed', 'wildcardSkill', 'defence', 'closing'] as const) {
        const rng = mulberry32(1234);
        let acted = 0;
        const N = 20_000;
        for (let i = 0; i < N; i++) {
          if (skilledEnough(rng, TRAITS[tier][facet])) acted += 1;
        }
        expect(Math.abs(acted / N - TRAITS[tier][facet])).toBeLessThan(0.02);
      }
    }
  });

  it('a full-strength skill (hard) always acts and consumes NO rng', () => {
    // If it drew rng, a shared generator would advance and later draws would differ; assert it does not.
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      expect(skilledEnough(rng, 1)).toBe(true);
    }
    expect(rng()).toBe(mulberry32(7)()); // the generator never advanced
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

  it('every move it returns is one the engine actually offered (always legal, never invented)', () => {
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

  it('AGGRESSION: the timid easy tier attacks far less than hard — and its fallback is a QUIET move', () => {
    const state = attackIsBest();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    // Sanity: the strong play here really is the attack.
    expect(isAttackMove(recommend(obs, legal, 'hard').action)).toBe(true);

    const countAttacks = (tier: 'easy' | 'hard') => {
      const rng = mulberry32(2024);
      let attacks = 0;
      let nonAttackWasLegalQuiet = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        const move = chooseWithDifficulty(obs, legal, rng, tier);
        if (isAttackMove(move)) {
          attacks += 1;
        } else {
          // When it doesn't attack, it must have chosen a real legal (non-attack) move, not nonsense.
          expect(legal).toContain(move);
          nonAttackWasLegalQuiet += 1;
        }
      }
      return { attackRate: attacks / N, nonAttackWasLegalQuiet };
    };

    const hard = countAttacks('hard');
    const easy = countAttacks('easy');
    expect(hard.attackRate).toBe(1); // hard always presses the winning attack
    expect(easy.attackRate).toBeLessThan(0.35); // easy mostly leaves its attack alone (aggression ~0.15)
    expect(easy.nonAttackWasLegalQuiet).toBeGreaterThan(0); // and its fallback is a genuine legal move
  });

  it('GREED: the easy tier fails to convert a build sometimes; hard always builds when it should', () => {
    const state = buildIsBest();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    const isBuild = (a: Action) => a.type === 'PLACE_PROPERTY' || a.type === 'REARRANGE_WILDCARD';
    expect(isBuild(recommend(obs, legal, 'hard').action)).toBe(true);

    const buildRate = (tier: 'easy' | 'hard') => {
      const rng = mulberry32(99);
      let builds = 0;
      const N = 2000;
      for (let i = 0; i < N; i++) {
        if (isBuild(chooseWithDifficulty(obs, legal, rng, tier))) builds += 1;
      }
      return builds / N;
    };
    expect(buildRate('hard')).toBe(1);
    expect(buildRate('easy')).toBeLessThan(0.9); // it drops the conversion a meaningful fraction of the time
  });

  it('easy deviates sometimes and agrees sometimes (a weak player, not a broken one)', () => {
    const state = midGame();
    const obs = observe(state, 0);
    const legal = legalActions(state, 0);
    const strong = recommend(obs, legal, 'easy').action;
    const rng = mulberry32(2024);
    let differed = 0;
    let agreed = 0;
    for (let i = 0; i < 2000; i++) {
      if (chooseWithDifficulty(obs, legal, rng, 'easy') === strong) agreed += 1;
      else differed += 1;
    }
    expect(differed).toBeGreaterThan(0);
    expect(agreed).toBeGreaterThan(0);
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
