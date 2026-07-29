/**
 * Unit tests for railForCard — the tap -> stage -> rail verb grouping (v1.2 A1). These
 * pin the model: which verbs a card offers, which is primary, and when a verb drills
 * down. Pure presentation logic over synthetic Action lists; no engine state needed.
 * Assertions read the whole verb array at once (keys / primaries / option-counts) so no
 * possibly-undefined indexing is needed.
 */
import { describe, it, expect } from 'vitest';
import type { Action } from '@sauda/engine';
import { railForCard } from './staging';

describe('railForCard (tap -> stage -> rail verb grouping)', () => {
  it('a money card offers only Bank, as the primary', () => {
    const actions: Action[] = [{ type: 'BANK_CARD', cardId: 'money_1' }];
    const verbs = railForCard(actions, 'money_1');
    expect(verbs.map((verb) => verb.key)).toEqual(['bank']);
    expect(verbs.map((verb) => verb.primary)).toEqual([true]);
    expect(verbs.map((verb) => verb.options.length)).toEqual([1]);
  });

  it('a property card offers a single-option Place (commits on one tap)', () => {
    const actions: Action[] = [{ type: 'PLACE_PROPERTY', cardId: 'prop_1', set: 'kolkata' }];
    const verbs = railForCard(actions, 'prop_1');
    expect(verbs.map((verb) => verb.key)).toEqual(['place']);
    expect(verbs.map((verb) => verb.primary)).toEqual([true]);
    expect(verbs.map((verb) => verb.options.length)).toEqual([1]);
  });

  it('a dual wildcard offers Place with one option per colour (drills down)', () => {
    const actions: Action[] = [
      { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'kolkata' },
      { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'mumbai' },
    ];
    const verbs = railForCard(actions, 'wild_1');
    expect(verbs.map((verb) => verb.key)).toEqual(['place']);
    expect(verbs.map((verb) => verb.options.length)).toEqual([2]);
  });

  it('an action card offers Play (effect, primary) and Bank (secondary)', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: 'act_1', params: { action: 'vasooli', target: 1 } },
      { type: 'PLAY_ACTION', cardId: 'act_1', params: { action: 'vasooli', target: 2 } },
      { type: 'BANK_CARD', cardId: 'act_1' },
    ];
    const verbs = railForCard(actions, 'act_1');
    expect(verbs.map((verb) => verb.key)).toEqual(['play', 'bank']);
    expect(verbs.map((verb) => verb.primary)).toEqual([true, false]); // Play primary, Bank not
    expect(verbs.map((verb) => verb.options.length)).toEqual([2, 1]); // two targets → drill-down
  });

  it('a building action routes to Build, not Play', () => {
    const actions: Action[] = [
      { type: 'PLAY_ACTION', cardId: 'act_2', params: { action: 'makaan', set: 'kolkata' } },
      { type: 'BANK_CARD', cardId: 'act_2' },
    ];
    const verbs = railForCard(actions, 'act_2');
    expect(verbs.map((verb) => verb.key)).toEqual(['build', 'bank']);
  });

  it('LAGAAN offers Charge with one option per colour/target/doubling', () => {
    const actions: Action[] = [
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'kolkata', target: null, dugnaCardIds: [] },
      { type: 'PLAY_KIRAYA', cardId: 'kir_1', color: 'kolkata', target: null, dugnaCardIds: ['dug_1'] },
      { type: 'BANK_CARD', cardId: 'kir_1' },
    ];
    const verbs = railForCard(actions, 'kir_1');
    expect(verbs.map((verb) => verb.key)).toEqual(['charge', 'bank']);
    expect(verbs.map((verb) => verb.options.length)).toEqual([2, 1]); // ×1 and ×2
  });

  it('ignores actions for other cards and non-play action kinds', () => {
    const actions: Action[] = [
      { type: 'PLACE_PROPERTY', cardId: 'other', set: 'kolkata' },
      { type: 'END_TURN' },
      { type: 'DRAW' },
    ];
    expect(railForCard(actions, 'prop_1')).toEqual([]);
  });
});
