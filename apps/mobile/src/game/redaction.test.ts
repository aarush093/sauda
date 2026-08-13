/**
 * S2 (owner directive, 13 Aug): the formatting layer must NEVER emit an opponent's cash total. This
 * pins that: the opponent-bank label and every banking string carry a COUNT / "a note", never a ₹
 * value. Debts (pay/receive) are the explicit exception and are formatted elsewhere.
 */
import { describe, it, expect } from 'vitest';
import { opponentBankLabel, NOTE_STACK_GLYPH, BANKED_A_NOTE } from './redaction';
import { shortLabel, describeEvent } from './labels';

// A rupee amount = the ₹ sign followed by a digit. This is the exact shape we must never leak for an
// opponent's standing bank (a lone ₹ with no number, if it ever appeared, is not a total).
const RUPEE_AMOUNT = /₹\s*\d/;

describe('opponent-cash redaction (S2)', () => {
  it('opponentBankLabel shows the note-stack glyph + count, never a ₹ total', () => {
    for (const count of [0, 1, 3, 7, 13]) {
      const label = opponentBankLabel(count);
      expect(label).toContain(NOTE_STACK_GLYPH);
      expect(label).toContain(String(count));
      expect(label).not.toMatch(RUPEE_AMOUNT);
    }
  });

  it('the spectate caption for a banked card says "banked a note", never the value', () => {
    // Money cards of several values — the caption must not reveal any of them.
    for (const cardId of ['money_1_0', 'money_2_0', 'money_5_0', 'money_10_0']) {
      const caption = shortLabel(cardId, { seat: 2, kind: 'banked' });
      expect(caption).toContain(`banked ${BANKED_A_NOTE}`);
      expect(caption).not.toMatch(RUPEE_AMOUNT);
    }
  });

  it('the ticker line for a banking event says "banked a note", never "₹N Cr"', () => {
    for (const [cardId, value] of [['money_1_0', 1], ['money_5_0', 5], ['money_10_0', 10]] as const) {
      // The event still CARRIES the value (engine byte-identical) — the formatter just declines to show it.
      const line = describeEvent({ type: 'CardBanked', player: 1, cardId, value });
      expect(line).toBe(`P1 banked ${BANKED_A_NOTE}`);
      expect(line).not.toMatch(RUPEE_AMOUNT);
    }
  });

  it('debts are NOT redacted — a payment line still names what changed hands (the exception)', () => {
    // Sanity that redaction did not over-reach: a Paid event still names the cards that changed hands.
    const paid = describeEvent({ type: 'Paid', debtor: 1, creditor: 0, cardIds: ['money_5_0'], amount: 5 });
    expect(paid).toContain('paid');
  });
});
