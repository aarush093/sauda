/**
 * R6 — the Munshi advice composer writes the SENTENCE in the UI layer from the frozen bot's
 * recommendation PLUS concrete PUBLIC facts. The contract these pin: every line names the move and
 * cites at least one concrete fact (set progress, a rival threat, the threat, a value, plays left),
 * and NEVER echoes the bot's own `line` (so the copy is genuinely UI-layer — @sauda/bots is frozen).
 */
import { describe, it, expect } from 'vitest';
import { SET_IDS, SETS, buildDeck } from '@sauda/engine';
import type { Action, InterruptView, Observation, OpponentView, PropertyGroup, SetId } from '@sauda/engine';
import type { MunshiAdvice, MunshiReason } from '@sauda/bots';
import { composeMunshiAdvice, nearestRivalThreat } from './munshiAdvice';

const deck = buildDeck();
const money5 = deck.find((c) => c.kind === 'money' && c.value === 5)!.id;

function emptyProps(): Record<SetId, PropertyGroup[]> {
  const record = {} as Record<SetId, PropertyGroup[]>;
  for (const set of SET_IDS) {
    record[set] = [];
  }
  return record;
}

function observation(overrides: Partial<Observation> = {}): Observation {
  return {
    me: 0,
    phase: 'playing',
    currentPlayer: 0,
    playsRemaining: 3,
    turnCount: 5,
    myHand: [],
    myBank: [],
    myBankTotal: 0,
    myProperties: emptyProps(),
    myKiraya: {} as Record<SetId, number[]>,
    opponents: [],
    drawPileCount: 40,
    discardPile: [],
    interrupt: null,
    winnerIndex: null,
    ...overrides,
  };
}

// A bogus `line` on purpose — if the composer ever echoed it, these would catch it.
function advice(reason: MunshiReason, action: Action): MunshiAdvice {
  return { reason, action, line: 'BOGUS bots line — must never appear' };
}

function opponentWith(id: number, set: SetId, cardCount: number): OpponentView {
  const props = emptyProps();
  props[set] = [{ set, cards: Array.from({ length: cardCount }, (_, i) => `${set}_card_${i}`), buildings: [] }];
  return { id, handCount: 4, bank: [], bankTotal: 0, properties: props };
}

describe('composeMunshiAdvice (R6 nuanced advice)', () => {
  it('completesSet cites set progress and names the placement', () => {
    // I hold 2 of a 3-card colour; placing one more makes it a full set.
    const jaipurGroup: PropertyGroup = { set: 'jaipur', cards: ['a', 'b'], buildings: [] };
    const obs = observation({ myProperties: { ...emptyProps(), jaipur: [jaipurGroup] } });
    const line = composeMunshiAdvice(advice('completesSet', { type: 'PLACE_PROPERTY', cardId: 'x', set: 'jaipur' }), obs);
    expect(line).toContain(SETS.jaipur.label);
    expect(line).toContain(`3 of ${SETS.jaipur.size}`); // the concrete progress fact
    expect(line).not.toContain('BOGUS');
  });

  it('deniesSet names the exact rival and colour being seized', () => {
    const kabza: Action = { type: 'PLAY_ACTION', cardId: 'k', params: { action: 'kabza', target: 2, set: 'chennai' } };
    const line = composeMunshiAdvice(advice('deniesSet', kabza), observation());
    expect(line).toContain('Kabza');
    expect(line).toContain('Bot 2');
    expect(line).toContain(SETS.chennai.label);
  });

  it('protectsSet cites the actual threat facing me', () => {
    const interrupt: InterruptView = { origin: 1, target: 0, status: 'awaitingPayment', effect: { kind: 'charge', amount: 5 } };
    const line = composeMunshiAdvice(advice('protectsSet', { type: 'RESPOND_NAHI_CHALEGA' } as Action), observation({ interrupt }));
    expect(line).toContain('Nahi Chalega');
    expect(line).toContain('5'); // the ₹5 charge — a concrete public fact
  });

  it('bestValue cites the card value', () => {
    const line = composeMunshiAdvice(advice('bestValue', { type: 'BANK_CARD', cardId: money5 }), observation());
    expect(line).toContain('₹5');
    expect(line.toLowerCase()).toContain('best value');
  });

  it('preservesCounter cites a visible rival threat when one exists, else says none is close', () => {
    const withThreat = observation({ opponents: [opponentWith(2, 'chennai', SETS.chennai.size - 1)] });
    const line = composeMunshiAdvice(advice('preservesCounter', { type: 'RESPOND_ALLOW' } as Action), withThreat);
    expect(line).toContain('Bot 2 is one card from a full');
    const noThreat = composeMunshiAdvice(advice('preservesCounter', { type: 'RESPOND_ALLOW' } as Action), observation());
    expect(noThreat).toContain('no opponent is one card from a full set');
  });

  it('generic names the move and cites plays left', () => {
    const line = composeMunshiAdvice(advice('generic', { type: 'BANK_CARD', cardId: money5 }), observation({ playsRemaining: 2 }));
    expect(line).toContain('2 plays left');
    expect(line.toLowerCase()).toContain('bank');
  });

  it('every reason yields a non-empty sentence and never echoes the bot line', () => {
    const reasons: MunshiReason[] = ['completesSet', 'deniesSet', 'protectsSet', 'bestValue', 'preservesCounter', 'generic'];
    for (const reason of reasons) {
      const line = composeMunshiAdvice(advice(reason, { type: 'BANK_CARD', cardId: money5 }), observation());
      expect(line.length).toBeGreaterThan(20);
      expect(line).not.toContain('BOGUS');
    }
  });
});

describe('nearestRivalThreat (public read only)', () => {
  it('finds an opponent one card from a full colour', () => {
    const obs = observation({ opponents: [opponentWith(3, 'chennai', SETS.chennai.size - 1)] });
    expect(nearestRivalThreat(obs)).toBe(`Bot 3 is one card from a full ${SETS.chennai.label}`);
  });

  it('returns null when no opponent is one away', () => {
    const obs = observation({ opponents: [opponentWith(3, 'chennai', 1)] });
    expect(nearestRivalThreat(obs)).toBeNull();
  });
});
