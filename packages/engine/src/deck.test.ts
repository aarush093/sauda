/**
 * Deck composition tests (§6, §8.2 edge case #20).
 *
 * This is the M0 gate: the deck must be exactly 106 cards with the exact
 * per-kind breakdown and money composition the spec mandates. If this drifts,
 * every later rule and probability is wrong, so we pin it hard here.
 */
import { describe, it, expect } from 'vitest';
import type { Card, CardKind } from './types';
import { buildDeck, shuffledDeck } from './deck';
import { mulberry32 } from './rng';

describe('deck composition (§6)', () => {
  const deck = buildDeck();

  // Small helper: how many cards of a given kind are in the deck.
  function countOfKind(kind: CardKind): number {
    return deck.filter((card) => card.kind === kind).length;
  }

  it('has exactly 106 cards', () => {
    expect(deck.length).toBe(106);
  });

  it('has the spec per-kind breakdown (28 + 11 + 34 + 13 + 20)', () => {
    expect(countOfKind('property')).toBe(28);
    expect(countOfKind('wildcard')).toBe(11);
    expect(countOfKind('action')).toBe(34);
    expect(countOfKind('kiraya')).toBe(13);
    expect(countOfKind('money')).toBe(20);
  });

  it('money totals ₹57 Cr (§6.5)', () => {
    let total = 0;
    for (const card of deck) {
      if (card.kind === 'money') {
        total += card.value;
      }
    }
    expect(total).toBe(57);
  });

  it('money denominations are 6×1, 5×2, 3×3, 3×4, 2×5, 1×10 (§6.5)', () => {
    const countByValue = new Map<number, number>();
    for (const card of deck) {
      if (card.kind === 'money') {
        countByValue.set(card.value, (countByValue.get(card.value) ?? 0) + 1);
      }
    }
    expect(countByValue.get(1)).toBe(6);
    expect(countByValue.get(2)).toBe(5);
    expect(countByValue.get(3)).toBe(3);
    expect(countByValue.get(4)).toBe(3);
    expect(countByValue.get(5)).toBe(2);
    expect(countByValue.get(10)).toBe(1);
  });

  it('the ANY wildcard has ₹0 value and can never be paid (§4.5, §6.2)', () => {
    const anyWildcards = deck.filter(
      (card): card is Extract<Card, { kind: 'wildcard' }> =>
        card.kind === 'wildcard' && card.colors === 'ANY',
    );
    expect(anyWildcards.length).toBe(2);
    for (const wildcard of anyWildcards) {
      expect(wildcard.value).toBe(0);
    }
  });

  it('every card id is unique', () => {
    const ids = deck.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic: two builds are identical', () => {
    expect(buildDeck().map((card) => card.id)).toEqual(buildDeck().map((card) => card.id));
  });

  it('shuffles reproducibly from a seed (§4.2)', () => {
    const first = shuffledDeck(mulberry32(42)).map((card) => card.id);
    const second = shuffledDeck(mulberry32(42)).map((card) => card.id);
    const different = shuffledDeck(mulberry32(43)).map((card) => card.id);

    expect(first).toEqual(second); // same seed ⇒ same order
    expect(first).not.toEqual(different); // different seed ⇒ (almost surely) different order
    expect([...first].sort()).toEqual([...buildDeck().map((card) => card.id)].sort()); // same cards
  });
});
