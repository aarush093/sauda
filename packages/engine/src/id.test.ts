/**
 * Card IDs must be theme-independent (project requirement).
 *
 * WHY THIS MATTERS: in M4 the game state is persisted across app kills, keyed by
 * card ID. If an ID were derived from a display name (e.g. "Marine Drive"), then
 * a rebrand editing theme.ts would change that ID and silently corrupt every
 * existing save. So we prove two things here:
 *   1. Every ID is built only from structural keys + an index (a fixed shape).
 *   2. No ID contains any human-facing string from theme.ts.
 *
 * The one deliberate exception in test (2): a display string that is, ignoring
 * case and punctuation, identical to a structural key (e.g. the set label
 * "Mumbai" equals the key `mumbai`, the action name "Kabza" equals the kind
 * `kabza`). The structural key is the *sanctioned* source of the ID, so that
 * coincidence is fine; every other display string is forbidden. (See DECISIONS.md.)
 */
import { describe, it, expect } from 'vitest';
import { buildDeck } from './deck';
import { SET_IDS, ACTION_KINDS } from './types';
import { GAME, SETS, PROPERTY_NAMES, ACTIONS } from './theme';

// Normalises a string to lowercase alphanumerics only, so comparison ignores
// case, spaces and punctuation ("New Delhi" and "newDelhi" both become "newdelhi").
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

describe('card ids are theme-independent', () => {
  const deck = buildDeck();

  it('every id has the structural shape <category>_<key>_<index>', () => {
    const idPattern = /^(prop|wild|action|kiraya|money)_[A-Za-z0-9_]+$/;
    for (const card of deck) {
      expect(card.id, `unexpected id shape: ${card.id}`).toMatch(idPattern);
    }
  });

  it('no id contains any human-facing string from theme.ts', () => {
    // The structural keys that are legitimately allowed to appear inside an ID.
    const structuralKeys = new Set<string>(
      [...SET_IDS, ...ACTION_KINDS, 'any', 'prop', 'wild', 'action', 'kiraya', 'money'].map(
        normalize,
      ),
    );

    // Every player-facing string that lives in theme.ts.
    const humanFacingStrings: string[] = [
      GAME.name,
      GAME.nameDevanagari,
      GAME.tagline,
      ...Object.values(SETS).map((set) => set.label),
      ...Object.values(PROPERTY_NAMES).flat(),
      ...Object.values(ACTIONS).flatMap((action) => [action.name, action.flavor]),
    ];

    // Strings that must never appear in an ID: the human-facing ones, minus any
    // that merely coincide with a structural key (see the block comment above).
    const forbidden = humanFacingStrings
      .map(normalize)
      .filter((text) => text.length >= 3 && !structuralKeys.has(text));

    for (const card of deck) {
      const normalizedId = normalize(card.id);
      for (const forbiddenText of forbidden) {
        expect(
          normalizedId.includes(forbiddenText),
          `id "${card.id}" must not contain human-facing text "${forbiddenText}"`,
        ).toBe(false);
      }
    }
  });
});
