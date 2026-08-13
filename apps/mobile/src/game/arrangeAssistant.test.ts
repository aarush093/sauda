/**
 * S4 — the wildcard combination assistant evaluator. It proposes only FREE rearrangements that
 * strictly improve my board: complete a set, complete TWO (depth 2), lift a surplus dual off an
 * already-full set to finish another, re-seat an ANY wildcard, or free a colour a hand card fills.
 * And it stays quiet when nothing helps. All six directive cases are pinned here.
 */
import { describe, it, expect } from 'vitest';
import { SET_IDS } from '@sauda/engine';
import type { Action, PropertyGroup, SetId } from '@sauda/engine';
import { evaluateArrangements } from './arrangeAssistant';

type Groups = Record<SetId, PropertyGroup[]>;

// Build a full groups map from a sparse spec (each colour → the cards in its single group).
function groups(spec: Partial<Record<SetId, string[]>>): Groups {
  const record = {} as Groups;
  for (const set of SET_IDS) {
    const cards = spec[set];
    record[set] = cards && cards.length ? [{ set, cards: [...cards], buildings: [] }] : [];
  }
  return record;
}
function rearrange(cardId: string, toSet: SetId): Action {
  return { type: 'REARRANGE_WILDCARD', cardId, toSet };
}

const DUAL = 'wild_jaipur_kolkata_0'; // colours jaipur/kolkata
const KP_DUAL = 'wild_kashi_puraniDilli_0'; // colours kashi/puraniDilli (puraniDilli is size 2)
const ANY0 = 'wild_any_0';
const ANY1 = 'wild_any_1';

describe('evaluateArrangements (S4)', () => {
  it("the owner's exact case: 2 pink + a pink/purple dual → the dual completes the set (depth 1)", () => {
    // jaipur (size 3) holds two real cards; the jaipur/kolkata dual is parked in kolkata.
    const s = evaluateArrangements(
      groups({ jaipur: ['prop_jaipur_0', 'prop_jaipur_1'], kolkata: [DUAL] }),
      [],
      [rearrange(DUAL, 'jaipur')],
    );
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('completesSet');
    expect(s!.moves).toHaveLength(1);
    expect(s!.targetSet).toBe('jaipur');
    expect(s!.moves[0]!.toSet).toBe('jaipur');
    expect(s!.summary).toMatch(/Completes/);
  });

  it('a dual parked on an already-FULL set is lifted to complete another colour', () => {
    // puraniDilli (size 2) is already complete with two real cards; the dual on top of it is surplus.
    const s = evaluateArrangements(
      groups({ puraniDilli: ['prop_puraniDilli_0', 'prop_puraniDilli_1', KP_DUAL], kashi: ['prop_kashi_0', 'prop_kashi_1'] }),
      [],
      [rearrange(KP_DUAL, 'kashi')],
    );
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('completesSet');
    expect(s!.targetSet).toBe('kashi');
  });

  it('a received property beats a wildcard’s seat: the rearrange frees a colour a hand card completes', () => {
    // jaipur has one real card (two short); moving the dual INTO jaipur makes it one short, so the
    // real jaipur property in hand now completes it — a hand-enabled completion, not a direct one.
    const s = evaluateArrangements(
      groups({ jaipur: ['prop_jaipur_0'], kolkata: [DUAL] }),
      ['prop_jaipur_1'],
      [rearrange(DUAL, 'jaipur')],
    );
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('enablesHandCompletion');
    expect(s!.targetSet).toBe('jaipur');
  });

  it('two duals swappable for TWO completions (depth 2)', () => {
    // jaipur and kolkata each need one; two ANY wildcards are parked in a bangalore sink.
    const s = evaluateArrangements(
      groups({ jaipur: ['prop_jaipur_0', 'prop_jaipur_1'], kolkata: ['prop_kolkata_0', 'prop_kolkata_1'], bangalore: [ANY0, ANY1] }),
      [],
      [rearrange(ANY0, 'jaipur'), rearrange(ANY1, 'kolkata')],
    );
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('completesSet');
    expect(s!.moves).toHaveLength(2); // two moves finish two colours
    expect(s!.summary).toMatch(/two sets/i);
  });

  it('an ANY wildcard re-seating that completes a set is found (depth 1)', () => {
    const s = evaluateArrangements(
      groups({ jaipur: ['prop_jaipur_0', 'prop_jaipur_1'], bangalore: [ANY0] }),
      [],
      [rearrange(ANY0, 'jaipur')],
    );
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('completesSet');
    expect(s!.targetSet).toBe('jaipur');
  });

  it('NEGATIVE: a legal rearrange that neither completes nor enables a hand card → no suggestion', () => {
    // Moving the dual to jaipur only makes it 2/3 — no completion, and the hand is empty.
    const s = evaluateArrangements(
      groups({ jaipur: ['prop_jaipur_0'], kolkata: [DUAL] }),
      [],
      [rearrange(DUAL, 'jaipur')],
    );
    expect(s).toBeNull();
  });

  it('NEGATIVE: no free wildcard moves at all → no suggestion', () => {
    const s = evaluateArrangements(groups({ jaipur: ['prop_jaipur_0', 'prop_jaipur_1'] }), ['prop_jaipur_2'], []);
    expect(s).toBeNull();
  });

  it('does not rob a complete set to make another (net-zero) — no suggestion', () => {
    // The dual currently COMPLETES jaipur (2 real + dual, size 3). Moving it to also-2/3 kolkata would
    // just trade one complete colour for another — no net gain, so it must stay quiet.
    const s = evaluateArrangements(
      groups({ jaipur: ['prop_jaipur_0', 'prop_jaipur_1', DUAL], kolkata: ['prop_kolkata_0', 'prop_kolkata_1'] }),
      [],
      [rearrange(DUAL, 'kolkata')],
    );
    expect(s).toBeNull();
  });

  it('never mutates the caller’s groups (pure)', () => {
    const g = groups({ jaipur: ['prop_jaipur_0', 'prop_jaipur_1'], kolkata: [DUAL] });
    const snapshot = JSON.stringify(g);
    evaluateArrangements(g, [], [rearrange(DUAL, 'jaipur')]);
    expect(JSON.stringify(g)).toBe(snapshot);
  });
});
