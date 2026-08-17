/**
 * @sauda/difficulty — the EASY opening-hand assist (U4). It must be a FAIR swap: the deck stays complete
 * (all 106 cards), the human's hand stays the same size but gains building material, other seats are
 * untouched, and it is deterministic. Proven here on real dealt games.
 */
import { describe, it, expect } from 'vitest';
import { createGame, checkInvariants } from '@sauda/engine';
import type { Card, GameState } from '@sauda/engine';
import { assistOpeningHand, EASY_OPENING_ASSIST_CARDS } from './opening-assist';

function allCardIds(state: GameState): string[] {
  const ids: string[] = [...state.drawPile, ...state.discardPile];
  for (const player of state.players) {
    ids.push(...player.hand, ...player.bank);
    for (const groups of Object.values(player.properties)) {
      for (const group of groups) {
        ids.push(...group.cards, ...group.buildings);
      }
    }
  }
  return ids;
}

function countKind(state: GameState, seat: number, kind: Card['kind']): number {
  return state.players[seat]!.hand.filter((id) => state.cards[id]!.kind === kind).length;
}

describe('easy opening-hand assist (U4)', () => {
  it('keeps the deck complete — every one of the 106 cards still present exactly once', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const before = createGame({ players: 2, seed }).state;
      const after = assistOpeningHand(before, 0);
      const ids = allCardIds(after);
      expect(ids.length).toBe(106);
      expect(new Set(ids).size).toBe(106); // no duplicates, none lost
    }
  });

  it('keeps the assisted hand the same SIZE and only ever GAINS building material', () => {
    let strictUpgrades = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const before = createGame({ players: 2, seed }).state;
      const buildBefore = countKind(before, 0, 'property') + countKind(before, 0, 'wildcard');
      const after = assistOpeningHand(before, 0);
      expect(after.players[0]!.hand.length).toBe(before.players[0]!.hand.length); // same size
      const buildAfter = countKind(after, 0, 'property') + countKind(after, 0, 'wildcard');
      // It trades away only non-building cards (money / actions / rent), so building material never
      // drops — the human only ever ends up with more set-building cards, never fewer.
      expect(buildAfter).toBeGreaterThanOrEqual(buildBefore);
      if (buildAfter > buildBefore) strictUpgrades += 1;
    }
    // Almost every fresh deal holds a non-building card to trade and a property waiting in the pile, so
    // the assist bites on a clear majority of deals.
    expect(strictUpgrades).toBeGreaterThan(15);
  });

  it('never upgrades more than the configured number of cards', () => {
    const before = createGame({ players: 2, seed: 7 }).state;
    const buildBefore = countKind(before, 0, 'property') + countKind(before, 0, 'wildcard');
    const after = assistOpeningHand(before, 0);
    const buildAfter = countKind(after, 0, 'property') + countKind(after, 0, 'wildcard');
    expect(buildAfter - buildBefore).toBeLessThanOrEqual(EASY_OPENING_ASSIST_CARDS);
  });

  it('leaves every OTHER seat untouched', () => {
    const before = createGame({ players: 3, seed: 5 }).state;
    const after = assistOpeningHand(before, 0);
    expect(after.players[1]!.hand).toEqual(before.players[1]!.hand);
    expect(after.players[2]!.hand).toEqual(before.players[2]!.hand);
  });

  it('is deterministic — same input state gives the same result', () => {
    const before = createGame({ players: 2, seed: 9 }).state;
    expect(assistOpeningHand(before, 0)).toEqual(assistOpeningHand(before, 0));
  });

  it('leaves the state passing every engine invariant', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const after = assistOpeningHand(createGame({ players: 4, seed }).state, 0);
      const check = checkInvariants(after);
      expect(check.ok, `seed ${seed}: ${check.ok ? '' : check.violations.join('; ')}`).toBe(true);
    }
  });
});
