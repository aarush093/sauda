/**
 * Mutation helpers for a player's property area, where each colour holds a LIST of
 * groups (sets). These handle the set-overflow rule (§ overflow): a colour never
 * overfills one group — surplus cards start a new group of the same colour.
 *
 * Kept separate from sets.ts (which is pure reads) because these mutate state.
 */
import { SETS } from './theme';
import type { SetId } from './types';
import type { CardId, PlayerState, PropertyGroup } from './state';

// Route a property/wildcard into a colour: fill the first group that still has
// room, otherwise start a new group. A group can therefore never exceed its size.
export function addToColor(player: PlayerState, set: SetId, cardId: CardId): void {
  const groups = player.properties[set];
  for (const group of groups) {
    if (group.cards.length < SETS[set].size) {
      group.cards.push(cardId);
      return;
    }
  }
  groups.push({ set, cards: [cardId], buildings: [] });
}

// The group that currently holds this property/wildcard, or null.
export function findGroupOf(player: PlayerState, cardId: CardId): PropertyGroup | null {
  for (const set of Object.keys(player.properties) as SetId[]) {
    for (const group of player.properties[set]) {
      if (group.cards.includes(cardId)) {
        return group;
      }
    }
  }
  return null;
}

// Remove a card from wherever it sits in the property area (a group's cards or
// buildings), pruning any group left completely empty. Returns true if removed.
export function removeFromProperties(player: PlayerState, cardId: CardId): boolean {
  for (const set of Object.keys(player.properties) as SetId[]) {
    for (const group of player.properties[set]) {
      if (removeId(group.cards, cardId) || removeId(group.buildings, cardId)) {
        pruneEmpty(player, set);
        return true;
      }
    }
  }
  return false;
}

// Drop groups of a colour that hold no cards and no buildings.
export function pruneEmpty(player: PlayerState, set: SetId): void {
  player.properties[set] = player.properties[set].filter(
    (group) => group.cards.length > 0 || group.buildings.length > 0,
  );
}

function removeId(list: CardId[], id: CardId): boolean {
  const index = list.indexOf(id);
  if (index === -1) {
    return false;
  }
  list.splice(index, 1);
  return true;
}
