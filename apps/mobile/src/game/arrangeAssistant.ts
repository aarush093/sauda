/**
 * The wildcard COMBINATION ASSISTANT evaluator (S4, owner playtest 13 Aug). When my placed cards
 * admit a strictly better arrangement using only the engine's FREE `REARRANGE_WILDCARD` moves, this
 * finds it — it never rearranges anything itself; it only proposes a sequence the UI can then fire
 * through the engine's own actions (so packages/engine stays byte-identical).
 *
 * Pure and DOM-free: given my property groups, my hand, and the current legalActions (which already
 * enumerate every legal wildcard move), it searches sequences of depth ≤ 2 that either
 *   (a) increase my completed-colour count (e.g. slide a dual over to finish a set, or lift a SURPLUS
 *       dual off an already-full set and complete another with it), or
 *   (b) free a colour that a property CURRENTLY IN MY HAND could then complete.
 * It returns the single best suggestion (most colours gained, then fewest moves), or null. Every move
 * it proposes was applicable to the simulated board, so Confirm can fire them as free REARRANGE moves.
 *
 * The owner's exact case (2 pink placed + a pink/purple dual seated elsewhere) is a depth-1 (a); two
 * duals that finish two different colours is a depth-2 (a); a received property that beats a
 * wildcard's seat is a (b). All are covered by the tests.
 */
import { SETS, buildDeck } from '@sauda/engine';
import type { Action, CardId, PropertyGroup, SetId } from '@sauda/engine';

const CARD_BY_ID = new Map(buildDeck().map((card) => [card.id, card]));
const ALL_SETS = Object.keys(SETS) as SetId[];

type Groups = Record<SetId, PropertyGroup[]>;

export interface ArrangeMove {
  cardId: CardId;
  toSet: SetId;
  label: string; // "Move Wildcard to Jaipur"
}

export interface ArrangeSuggestion {
  moves: ArrangeMove[]; // the free REARRANGE sequence to fire, in order (depth 1 or 2)
  kind: 'completesSet' | 'enablesHandCompletion';
  targetSet: SetId; // the colour the nudge sits beside (where the gain lands)
  endGroups: Groups; // the simulated end-state, for the preview overlay
  summary: string; // one quiet line, e.g. "Completes your Jaipur set"
}

// Deep-clone the groups map so a simulation never mutates the live observation.
function cloneGroups(groups: Groups): Groups {
  const next = {} as Groups;
  for (const set of ALL_SETS) {
    next[set] = (groups[set] ?? []).map((group) => ({
      set: group.set,
      cards: [...group.cards],
      buildings: [...group.buildings],
    }));
  }
  return next;
}

// The colour a placed card currently sits in, or null.
function currentSetOf(groups: Groups, cardId: CardId): SetId | null {
  for (const set of ALL_SETS) {
    for (const group of groups[set] ?? []) {
      if (group.cards.includes(cardId)) {
        return set;
      }
    }
  }
  return null;
}

// Apply one REARRANGE: pull cardId out of its current group, drop it into the first non-full group of
// toSet (or a fresh group). Returns a NEW groups map; leaves the input untouched. Mirrors the engine's
// placement rule (first non-full group, else a new one) so the simulation matches what reduce will do.
function applyRearrange(groups: Groups, cardId: CardId, toSet: SetId): Groups {
  const next = cloneGroups(groups);
  const from = currentSetOf(next, cardId);
  if (from) {
    for (const group of next[from]) {
      const at = group.cards.indexOf(cardId);
      if (at !== -1) {
        group.cards.splice(at, 1);
        break;
      }
    }
    // drop any now-empty group so it doesn't read as a phantom colour
    next[from] = next[from].filter((group) => group.cards.length > 0 || group.buildings.length > 0);
  }
  const size = SETS[toSet].size;
  const open = next[toSet].find((group) => group.cards.length < size);
  if (open) {
    open.cards.push(cardId);
  } else {
    next[toSet].push({ set: toSet, cards: [cardId], buildings: [] });
  }
  return next;
}

// Does this colour have at least one complete group?
function isColourComplete(groups: Groups, set: SetId): boolean {
  return (groups[set] ?? []).some((group) => group.cards.length >= SETS[set].size);
}

// How many DISTINCT colours I hold a complete set of (a 2nd same-colour set doesn't help the win).
function completedColours(groups: Groups): number {
  let count = 0;
  for (const set of ALL_SETS) {
    if (isColourComplete(groups, set)) {
      count += 1;
    }
  }
  return count;
}

// The colours a card could join for me (fixed property → its set; wildcard → its colours / ANY → all).
function colourOptions(cardId: CardId): SetId[] {
  const card = CARD_BY_ID.get(cardId);
  if (!card) {
    return [];
  }
  if (card.kind === 'property') {
    return [card.set];
  }
  if (card.kind === 'wildcard') {
    return card.colors === 'ANY' ? ALL_SETS : [...card.colors];
  }
  return [];
}

// The colours a card in HAND could complete right now: a not-yet-complete colour with a group exactly
// one short of full. (An empty colour needing more than one card can't be completed by a single card.)
function handCompletableColours(groups: Groups, hand: CardId[]): Set<SetId> {
  const out = new Set<SetId>();
  for (const cardId of hand) {
    for (const set of colourOptions(cardId)) {
      if (isColourComplete(groups, set)) {
        continue; // already complete → a hand card there is wasted for the win
      }
      const size = SETS[set].size;
      const nearest = (groups[set] ?? []).reduce((best, group) => Math.max(best, group.cards.length), 0);
      if (nearest > 0 && nearest === size - 1) {
        out.add(set); // one card away → this hand card completes it
      }
    }
  }
  return out;
}

function rearrangeLabel(cardId: CardId, toSet: SetId): string {
  const card = CARD_BY_ID.get(cardId);
  const name = card?.kind === 'wildcard' ? 'Wildcard' : (card?.kind === 'property' ? 'Property' : 'card');
  return `Move ${name} to ${SETS[toSet].label}`;
}

// The free wildcard moves the engine currently offers me.
function legalRearranges(legalActions: Action[]): { cardId: CardId; toSet: SetId }[] {
  const out: { cardId: CardId; toSet: SetId }[] = [];
  for (const action of legalActions) {
    if (action.type === 'REARRANGE_WILDCARD') {
      out.push({ cardId: action.cardId, toSet: action.toSet });
    }
  }
  return out;
}

// THE EVALUATOR. Returns the single best free-rearrangement suggestion, or null when the board is
// already arranged as well as free moves allow. Never mutates its inputs.
export function evaluateArrangements(
  myProperties: Groups,
  hand: CardId[],
  legalActions: Action[],
): ArrangeSuggestion | null {
  const moves = legalRearranges(legalActions);
  if (moves.length === 0) {
    return null;
  }
  const baseCompleted = completedColours(myProperties);
  const baseHandColours = handCompletableColours(myProperties, hand);

  // Collect every improving candidate, then pick the best (an array avoids TS's closure-narrowing).
  const candidates: { suggestion: ArrangeSuggestion; score: number }[] = [];
  const consider = (suggestion: ArrangeSuggestion, score: number) => {
    candidates.push({ suggestion, score });
  };

  const colourJustCompleted = (before: Groups, after: Groups): SetId => {
    for (const set of ALL_SETS) {
      if (!isColourComplete(before, set) && isColourComplete(after, set)) {
        return set;
      }
    }
    return ALL_SETS[0]!;
  };
  const colourFreedForHand = (after: Groups): SetId | null => {
    for (const set of handCompletableColours(after, hand)) {
      if (!baseHandColours.has(set)) {
        return set;
      }
    }
    return null;
  };

  for (const m1 of moves) {
    const g1 = applyRearrange(myProperties, m1.cardId, m1.toSet);
    const c1 = completedColours(g1);
    if (c1 > baseCompleted) {
      const set = colourJustCompleted(myProperties, g1);
      consider(
        { moves: [{ ...m1, label: rearrangeLabel(m1.cardId, m1.toSet) }], kind: 'completesSet', targetSet: set, endGroups: g1, summary: `Completes your ${SETS[set].label} set` },
        (c1 - baseCompleted) * 100 - 1,
      );
    } else {
      const freed = colourFreedForHand(g1);
      if (freed) {
        consider(
          { moves: [{ ...m1, label: rearrangeLabel(m1.cardId, m1.toSet) }], kind: 'enablesHandCompletion', targetSet: freed, endGroups: g1, summary: `Frees ${SETS[freed].label} — a card in hand completes it` },
          50 - 1,
        );
      }
    }

    // depth 2: a second free move (a different wildcard) that finishes ANOTHER colour on top of m1.
    for (const m2 of moves) {
      if (m2.cardId === m1.cardId) {
        continue; // moving the same wildcard twice is never the shortest path
      }
      const g2 = applyRearrange(g1, m2.cardId, m2.toSet);
      const c2 = completedColours(g2);
      if (c2 > baseCompleted && c2 > c1) {
        const set = colourJustCompleted(g1, g2);
        consider(
          {
            moves: [
              { ...m1, label: rearrangeLabel(m1.cardId, m1.toSet) },
              { ...m2, label: rearrangeLabel(m2.cardId, m2.toSet) },
            ],
            kind: 'completesSet',
            targetSet: set,
            endGroups: g2,
            summary: `Completes two sets — ${SETS[colourJustCompleted(myProperties, g1)].label} and ${SETS[set].label}`,
          },
          (c2 - baseCompleted) * 100 - 2,
        );
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  // highest score first; on a tie prefer FEWER moves (a simpler suggestion reads clearer).
  candidates.sort((a, b) => b.score - a.score || a.suggestion.moves.length - b.suggestion.moves.length);
  return candidates[0]!.suggestion;
}
