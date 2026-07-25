/**
 * Hidden-information view (§8.1): a player sees their own hand in full, but only
 * opponents' hand COUNTS, and only the count of the draw pile.
 */
import { describe, it, expect } from 'vitest';
import { observe } from './observe';
import { makeState } from './testkit';

describe('observe (§8.1)', () => {
  it('shows my hand but hides opponents’ cards', () => {
    const state = makeState({
      players: [
        { hand: ['money_5_0', 'prop_mumbai_0'], bank: ['money_1_0'] },
        { hand: ['action_kabza_0', 'action_kabza_1'] },
      ],
    });
    const view = observe(state, 0);

    expect(view.myHand).toEqual(['money_5_0', 'prop_mumbai_0']);
    expect(view.myBank).toEqual(['money_1_0']);

    expect(view.opponents).toHaveLength(1);
    const opponent = view.opponents[0]!;
    expect(opponent.handCount).toBe(2);
    // The opponent view has no way to read the actual hand cards.
    expect(opponent).not.toHaveProperty('hand');
  });

  it('exposes only the count of the hidden draw pile, and the public discard', () => {
    const state = makeState({ players: [{}, {}], discardPile: ['money_1_0'] });
    const view = observe(state, 0);
    expect(view.drawPileCount).toBe(state.drawPile.length);
    expect(view.discardPile).toEqual(['money_1_0']);
  });
});
