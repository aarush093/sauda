/**
 * Builds the 106-card SAUDA deck from the data in theme.ts (§6).
 *
 * Card IDs are the important part here. Each ID has the shape
 * `<category>_<structuralKey>_<index>` — e.g. `prop_mumbai_0`, `action_kabza_1`.
 * They are built ONLY from structural keys (SetId / ActionKind) and a running
 * counter, never from display names. That is what makes them theme-independent:
 * a rebrand in theme.ts changes labels but not IDs, so a saved game (M4) that
 * references cards by ID can never be corrupted by an edit to the text.
 */
import type { Card } from './types';
import { SET_IDS, ACTION_KINDS } from './types';
import { SETS, PROPERTY_NAMES, WILDCARDS, KIRAYA, MONEY, ACTIONS } from './theme';
import { shuffle, type Rng } from './rng';

// Turns a colour list into the ID fragment for wildcard/kiraya cards.
// 'ANY' becomes 'any'; a colour pair becomes e.g. 'jaipur_kolkata'.
function colorsToIdFragment(colors: readonly string[] | 'ANY'): string {
  if (colors === 'ANY') {
    return 'any';
  }
  return colors.join('_');
}

// §6.1: one property card per named street, tagged with its set and its index
// into that set's name list (the index is how its display name is recovered).
function buildPropertyCards(): Card[] {
  const cards: Card[] = [];
  for (const set of SET_IDS) {
    const names = PROPERTY_NAMES[set];
    for (let index = 0; index < names.length; index++) {
      cards.push({
        id: `prop_${set}_${index}`,
        kind: 'property',
        set,
        index,
        value: SETS[set].value,
      });
    }
  }
  return cards;
}

// §6.2: `count` copies of each wildcard type.
function buildWildcardCards(): Card[] {
  const cards: Card[] = [];
  for (const wildcard of WILDCARDS) {
    const fragment = colorsToIdFragment(wildcard.colors);
    for (let copy = 0; copy < wildcard.count; copy++) {
      cards.push({
        id: `wild_${fragment}_${copy}`,
        kind: 'wildcard',
        colors: wildcard.colors,
        value: wildcard.value,
      });
    }
  }
  return cards;
}

// §5: `count` copies of each action kind.
function buildActionCards(): Card[] {
  const cards: Card[] = [];
  for (const kind of ACTION_KINDS) {
    const action = ACTIONS[kind];
    for (let copy = 0; copy < action.count; copy++) {
      cards.push({
        id: `action_${kind}_${copy}`,
        kind: 'action',
        action: kind,
        value: action.value,
      });
    }
  }
  return cards;
}

// §6.4: `count` copies of each KIRAYA card.
function buildKirayaCards(): Card[] {
  const cards: Card[] = [];
  for (const kiraya of KIRAYA) {
    const fragment = colorsToIdFragment(kiraya.colors);
    for (let copy = 0; copy < kiraya.count; copy++) {
      cards.push({
        id: `kiraya_${fragment}_${copy}`,
        kind: 'kiraya',
        colors: kiraya.colors,
        value: kiraya.value,
        targeted: kiraya.targeted,
      });
    }
  }
  return cards;
}

// §6.5: `count` copies of each money denomination.
function buildMoneyCards(): Card[] {
  const cards: Card[] = [];
  for (const denomination of MONEY) {
    for (let copy = 0; copy < denomination.count; copy++) {
      cards.push({
        id: `money_${denomination.value}_${copy}`,
        kind: 'money',
        value: denomination.value,
      });
    }
  }
  return cards;
}

// Builds the full 106-card deck in canonical (unshuffled) order. Deterministic:
// calling it twice yields the same cards in the same order.
export function buildDeck(): Card[] {
  return [
    ...buildPropertyCards(),
    ...buildWildcardCards(),
    ...buildActionCards(),
    ...buildKirayaCards(),
    ...buildMoneyCards(),
  ];
}

// Builds the deck and shuffles it with a seeded Rng (§4.2 setup). Same seed ⇒
// same shuffle, so a whole game is reproducible from its seed.
export function shuffledDeck(rng: Rng): Card[] {
  return shuffle(buildDeck(), rng);
}
