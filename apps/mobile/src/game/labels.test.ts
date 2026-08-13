/**
 * PHONE-2 Q2 — the Munshi advice COPY lives in the UI layer (labels.ts), mapped from the bot's
 * recommendation `reason`, not from @sauda/bots' own advice.line. These tests pin that contract:
 *  - every reason yields a crisp, full sentence (capitalised, ends in a full stop);
 *  - the set-specific reasons name the exact colour read off the action;
 *  - the mapping ignores advice.line entirely (proving the copy is genuinely UI-layer, so a rewrite
 *    here never touches the frozen bots package).
 */
import { describe, it, expect } from 'vitest';
import { SETS, buildDeck, PROPERTY_NAMES } from '@sauda/engine';
import type { Action, Card, GameEvent } from '@sauda/engine';
import type { MunshiAdvice, MunshiReason } from '@sauda/bots';
import { munshiAdviceLine, shortLabel, stagePlayFromEvents } from './labels';

const placeInMumbai: Action = { type: 'PLACE_PROPERTY', cardId: 'wild_1', set: 'mumbai' };
const bankMoney: Action = { type: 'BANK_CARD', cardId: 'money_1' };
const kabzaKolkata: Action = { type: 'PLAY_ACTION', cardId: 'act_1', params: { action: 'kabza', target: 1, set: 'kolkata' } };

// A bogus `line` on purpose — if the UI copy ever leaked back to it, these assertions would catch it.
function advice(reason: MunshiReason, action: Action): MunshiAdvice {
  return { reason, action, line: 'BOGUS bots line — must never appear' };
}

const ALL_REASONS: MunshiReason[] = [
  'completesSet',
  'deniesSet',
  'protectsSet',
  'bestValue',
  'preservesCounter',
  'generic',
];

describe('munshiAdviceLine (PHONE-2 Q2 advice copy)', () => {
  it('gives every reason a full, crisp sentence', () => {
    for (const reason of ALL_REASONS) {
      const line = munshiAdviceLine(advice(reason, placeInMumbai));
      expect(line.length).toBeGreaterThan(20);
      expect(line[0]).toBe(line[0]!.toUpperCase()); // starts capitalised
      expect(line.endsWith('.')).toBe(true); // ends as a sentence
      expect(line).not.toContain('BOGUS'); // never echoes the bots line
    }
  });

  it('names the exact colour a set-completing move concerns', () => {
    const line = munshiAdviceLine(advice('completesSet', placeInMumbai));
    expect(line).toContain(SETS.mumbai.label);
  });

  it('falls back to a colourless sentence when the move concerns no set', () => {
    const line = munshiAdviceLine(advice('completesSet', bankMoney));
    expect(line).toContain('completes a set');
  });

  it('names the seized colour for a Kabza denial', () => {
    const line = munshiAdviceLine(advice('deniesSet', kabzaKolkata));
    expect(line).toContain('Kabza');
    expect(line).toContain(SETS.kolkata.label);
  });

  it('tells the player which counter to spend when protecting', () => {
    expect(munshiAdviceLine(advice('protectsSet', placeInMumbai))).toContain('Nahi Chalega');
  });
});

// R2 — the spectate stage caption. shortLabel is the primitive that fixes the hidden-text bug (the
// label now reads BESIDE the card, not behind it), so it must produce a correct short caption for
// EVERY card family and every play kind. Ids come from the real deck, so a card-scheme change is caught.
const DECK: Card[] = buildDeck();
function idOf(pred: (card: Card) => boolean): string {
  const card = DECK.find(pred);
  if (!card) {
    throw new Error('test fixture: no such card in the deck');
  }
  return card.id;
}
const chennaiCentral = idOf((c) => c.kind === 'property' && c.set === 'junction' && c.index === 3);
const annaSalai = idOf((c) => c.kind === 'property' && c.set === 'chennai' && c.index === 1);
const vasooli = idOf((c) => c.kind === 'action' && c.action === 'vasooli');
const makaan = idOf((c) => c.kind === 'action' && c.action === 'makaan');
const money3 = idOf((c) => c.kind === 'money' && c.value === 3);
const wild = idOf((c) => c.kind === 'wildcard');
const kiraya = idOf((c) => c.kind === 'kiraya');

describe('shortLabel (R2 spectate caption — every card family)', () => {
  it('names a placed property after the seat chip', () => {
    expect(shortLabel(chennaiCentral, { seat: 2, kind: 'placed' })).toBe('B2 · Chennai Central');
    expect(shortLabel(annaSalai, { seat: 1, kind: 'placed' })).toBe('B1 · Anna Salai');
  });

  it('reads a played action as its UPPERCASE desi name, with → You when it targets me', () => {
    expect(shortLabel(vasooli, { seat: 2, kind: 'played' })).toBe('B2 · VASOOLI');
    expect(shortLabel(vasooli, { seat: 2, kind: 'played', targetsMe: true })).toBe('B2 · VASOOLI → You');
  });

  it('redacts a banked card to "a note" — its value/identity is private (S2)', () => {
    // S2 (owner directive, 13 Aug): a banked card is face-down to opponents, so the spectate caption
    // reveals neither its ₹ value nor its identity — only that a note was banked.
    expect(shortLabel(money3, { seat: 3, kind: 'banked' })).toBe('B3 · banked a note');
    expect(shortLabel(vasooli, { seat: 3, kind: 'banked' })).toBe('B3 · banked a note');
  });

  it('reads a built card and a received card', () => {
    expect(shortLabel(makaan, { seat: 1, kind: 'built' })).toBe('B1 · MAKAAN');
    expect(shortLabel(chennaiCentral, { seat: 2, kind: 'received' })).toBe('B2 · got Chennai Central');
  });

  it('handles the wildcard and rent families', () => {
    expect(shortLabel(wild, { seat: 1, kind: 'placed' })).toBe('B1 · Wildcard');
    expect(shortLabel(kiraya, { seat: 2, kind: 'played' })).toBe('B2 · LAGAAN');
  });

  it('keeps the caption short — the name portion never exceeds the cap', () => {
    for (const id of DECK.map((c) => c.id)) {
      const label = shortLabel(id, { seat: 2, kind: 'placed' });
      const rest = label.slice(label.indexOf(' · ') + 3);
      expect(rest.length).toBeLessThanOrEqual(20);
    }
  });

  it('never wraps a bare id — an unknown card still gets a seat chip', () => {
    expect(shortLabel('not_a_real_card', { seat: 2, kind: 'placed' })).toMatch(/^B2 · /);
  });

  // Every property name is short enough to caption without truncation (a spec sanity check).
  it('captions every real property name without ellipsis', () => {
    for (const set of Object.keys(PROPERTY_NAMES) as (keyof typeof PROPERTY_NAMES)[]) {
      PROPERTY_NAMES[set].forEach((_name, index) => {
        const id = idOf((c) => c.kind === 'property' && c.set === set && c.index === index);
        expect(shortLabel(id, { seat: 1, kind: 'placed' })).not.toContain('…');
      });
    }
  });
});

describe('stagePlayFromEvents (which card the acting bot just played)', () => {
  const banked: GameEvent = { type: 'CardBanked', player: 2, cardId: money3, value: 3 };
  const placed: GameEvent = { type: 'PropertyPlaced', player: 2, cardId: annaSalai, set: 'chennai' };
  const built: GameEvent = { type: 'BuildingPlaced', player: 2, cardId: makaan, set: 'chennai', building: 'makaan' };
  const played: GameEvent = { type: 'ActionPlayed', player: 2, cardId: vasooli, action: 'vasooli' };

  it('returns the acting player\'s most recent spotlight-setting event', () => {
    const result = stagePlayFromEvents([banked, placed], 2);
    expect(result).toEqual({ cardId: annaSalai, play: { seat: 2, kind: 'placed' } });
  });

  it('maps each event type to its play kind', () => {
    expect(stagePlayFromEvents([banked], 2)?.play.kind).toBe('banked');
    expect(stagePlayFromEvents([built], 2)?.play.kind).toBe('built');
    expect(stagePlayFromEvents([played], 2)?.play.kind).toBe('played');
  });

  it('ignores events from other players and returns null when the actor has none', () => {
    const otherPlayer: GameEvent = { type: 'ActionPlayed', player: 1, cardId: vasooli, action: 'vasooli' };
    expect(stagePlayFromEvents([otherPlayer], 2)).toBeNull();
    expect(stagePlayFromEvents([], 2)).toBeNull();
  });
});
