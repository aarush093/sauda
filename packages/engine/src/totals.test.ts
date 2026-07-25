/**
 * Totals audit: the numbers the UI shows come from `observe()` (the engine), so
 * this verifies those numbers against the engine's own rule functions. If these
 * pass, every on-screen total is engine-derived, not recomputed in a component.
 */
import { describe, it, expect } from 'vitest';
import { cardPayValue, getCard, kirayaForGroup, makeState, observe } from './index';

describe('displayed totals come from the engine', () => {
  it('bank totals equal the sum of bankable values; ANY wildcard is ₹0 and excluded', () => {
    const state = makeState({
      players: [
        { bank: ['money_5_0', 'money_1_0', 'money_1_1'], properties: { jaipur: { cards: ['wild_any_0'] } } },
        { bank: ['money_10_0'] },
      ],
    });
    const view = observe(state, 0);

    expect(view.myBankTotal).toBe(7); // 5 + 1 + 1
    expect(view.opponents[0]!.bankTotal).toBe(10);

    // The ANY wildcard is worth ₹0 and never adds to a total…
    expect(cardPayValue(getCard(state, 'wild_any_0'))).toBe(0);
    // …but it still counts as a property the player owns.
    expect(view.myProperties.jaipur[0]!.cards).toContain('wild_any_0');
  });

  it('a set’s displayed kiraya matches kirayaForGroup, including the building bonus', () => {
    const state = makeState({
      players: [
        {
          properties: {
            mumbai: { cards: ['prop_mumbai_0', 'prop_mumbai_1'], buildings: ['action_makaan_0'] },
          },
        },
        {},
      ],
    });
    const view = observe(state, 0);
    const group = state.players[0]!.properties.mumbai[0]!;

    expect(view.myKiraya.mumbai[0]).toBe(kirayaForGroup(state, group, 0));
    expect(view.myKiraya.mumbai[0]).toBe(8 + 3); // mumbai rent[1]=8, +₹3 for the makaan
  });

  it('owned/needed counts and per-group rent are correct across overflow', () => {
    const state = makeState({
      players: [
        {
          properties: {
            jaipur: [
              { cards: ['prop_jaipur_0', 'prop_jaipur_1', 'prop_jaipur_2'] }, // complete: rent[2]=4
              { cards: ['wild_jaipur_kolkata_0'] }, // second set: rent[0]=1
            ],
          },
        },
        {},
      ],
    });
    const view = observe(state, 0);

    expect(view.myProperties.jaipur).toHaveLength(2); // two sets shown separately
    expect(view.myProperties.jaipur[0]!.cards).toHaveLength(3);
    expect(view.myProperties.jaipur[1]!.cards).toHaveLength(1);
    expect(view.myKiraya.jaipur).toEqual([4, 1]); // per group, not summed
  });
});
