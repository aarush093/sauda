/**
 * PHONE-2 Q2 — the Munshi advice COPY lives in the UI layer (labels.ts), mapped from the bot's
 * recommendation `reason`, not from @sauda/bots' own advice.line. These tests pin that contract:
 *  - every reason yields a crisp, full sentence (capitalised, ends in a full stop);
 *  - the set-specific reasons name the exact colour read off the action;
 *  - the mapping ignores advice.line entirely (proving the copy is genuinely UI-layer, so a rewrite
 *    here never touches the frozen bots package).
 */
import { describe, it, expect } from 'vitest';
import { SETS } from '@sauda/engine';
import type { Action } from '@sauda/engine';
import type { MunshiAdvice, MunshiReason } from '@sauda/bots';
import { munshiAdviceLine } from './labels';

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
