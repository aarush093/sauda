/**
 * Small, single-job helpers for reading property groups, set completion, and
 * kiraya (rent). Everything here is a pure read over GameState — no mutation.
 * These are the vocabulary the rest of the engine speaks in (§4, §5, §6).
 */
import type { Card, SetId } from './types';
import { SETS } from './theme';
import type { CardId, GameState, PlayerId, PropertyGroup } from './state';

export function getCard(state: GameState, cardId: CardId): Card {
  const card = state.cards[cardId];
  if (!card) {
    throw new Error(`Unknown card id: ${cardId}`);
  }
  return card;
}

// The ANY wildcard has ₹0 value and can never be used as payment (§4.5, §6.2).
export function isAnyWildcard(card: Card): boolean {
  return card.kind === 'wildcard' && card.colors === 'ANY';
}

// Which colour groups a card may be placed in.
// A fixed property → just its set. A wildcard → its colour list (or every set for ANY).
export function placeableSets(card: Card): SetId[] {
  if (card.kind === 'property') {
    return [card.set];
  }
  if (card.kind === 'wildcard') {
    return card.colors === 'ANY' ? [...ALL_SETS] : [...card.colors];
  }
  return [];
}

export function canPlaceInSet(card: Card, set: SetId): boolean {
  return placeableSets(card).includes(set);
}

const ALL_SETS = Object.keys(SETS) as SetId[];

// §6.1: a set is complete once it holds at least `size` property/wildcard cards.
// Buildings are NOT counted toward completion.
export function isSetComplete(group: PropertyGroup): boolean {
  return group.cards.length >= SETS[group.set].size;
}

// Total number of complete GROUPS across all colours. A colour with two complete
// groups (via overflow) contributes 2 — each complete group is its own set.
export function completeSetCount(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId]!;
  let complete = 0;
  for (const set of ALL_SETS) {
    for (const group of player.properties[set]) {
      if (isSetComplete(group)) {
        complete += 1;
      }
    }
  }
  return complete;
}

// Number of distinct COLOURS in which the player has at least one complete set.
export function distinctCompleteColorCount(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId]!;
  let colors = 0;
  for (const set of ALL_SETS) {
    if (player.properties[set].some(isSetComplete)) {
      colors += 1;
    }
  }
  return colors;
}

// §4.1: win = 3 complete sets of 3 DIFFERENT colours. So we count distinct
// colours, NOT total complete sets — two complete same-colour sets are only one
// colour. (The official "same-colour-allowed" variant is a deliberate deviation;
// it could live behind a rules flag later — see DECISIONS.md.)
export function hasThreeCompleteSets(state: GameState, playerId: PlayerId): boolean {
  return distinctCompleteColorCount(state, playerId) >= 3;
}

// Does this group hold a building of the given kind?
function hasBuilding(state: GameState, group: PropertyGroup, kind: 'makaan' | 'haveli'): boolean {
  return group.buildings.some((id) => {
    const card = getCard(state, id);
    return card.kind === 'action' && card.action === kind;
  });
}

export function hasMakaan(state: GameState, group: PropertyGroup): boolean {
  return hasBuilding(state, group, 'makaan');
}

export function hasHaveli(state: GameState, group: PropertyGroup): boolean {
  return hasBuilding(state, group, 'haveli');
}

// §5: kiraya for a single group = rent for the properties in it, plus building
// bonuses if that group is complete, times the DUGNA multiplier.
export function kirayaForGroup(
  state: GameState,
  group: PropertyGroup,
  dugnaCount: number,
): number {
  const ownedCount = group.cards.length;
  if (ownedCount === 0) {
    return 0;
  }

  // rent[i] is the rent for owning i+1 properties; cap at the full-set entry.
  const rentTable = SETS[group.set].rent;
  const rentIndex = Math.min(ownedCount, rentTable.length) - 1;
  let amount = rentTable[rentIndex] ?? 0;

  // §5, edge #13: building bonuses apply only when the group is complete.
  if (isSetComplete(group) && state.rules.buildingsStackRent) {
    if (hasMakaan(state, group)) {
      amount += 3;
    }
    if (hasHaveli(state, group)) {
      amount += 4;
    }
  }

  // §5: DUGNA doubles per stack (2^count). dugnaCount is capped by the caller.
  return amount * Math.pow(2, dugnaCount);
}

// §5: kiraya charged for a COLOUR. Each group of that colour is its own set, so we
// charge the best (highest-rent) group. Returns 0 if you own none of that colour
// (you may not charge it — §5, edge #12).
export function kirayaFor(
  state: GameState,
  playerId: PlayerId,
  color: SetId,
  dugnaCount: number,
): number {
  const player = state.players[playerId]!;
  let best = 0;
  for (const group of player.properties[color]) {
    best = Math.max(best, kirayaForGroup(state, group, dugnaCount));
  }
  return best;
}

// True if the player owns at least one property of a colour (any group).
export function ownsColor(state: GameState, playerId: PlayerId, color: SetId): boolean {
  return state.players[playerId]!.properties[color].some((group) => group.cards.length > 0);
}
